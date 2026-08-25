// The scheduler, over BullMQ.
//
// One queue for the whole service, one job per (room, kind). BullMQ keeps
// delayed jobs in Redis, so an alarm armed by one instance is rung by whichever
// instance happens to be free — and survives the redeployment that would have
// thrown away a `setTimeout`.
//
// The worker calls back into the room and nothing else: what an alarm *means* is
// a rule, and rules live in `@wikifake/domain`. This file knows only that
// something has to happen later.
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { alarmId, type Alarm, type OnAlarm, type Scheduler } from './scheduler.js';

export interface QueueOptions {
  readonly url: string;
  /** Prefixed so two deployments on one Redis do not ring each other's alarms. */
  readonly namespace?: string;
  readonly onAlarm: OnAlarm;
}

const QUEUE = 'room-timers';

/**
 * A connection for BullMQ, which means `ioredis`.
 *
 * A second Redis driver in a service that already has node-redis, and it is not
 * a preference: BullMQ 6 made `ioredis` optional and offers node-redis as an
 * alternative, but its **worker** does not process a job through one — armed
 * alarms simply never ring, and `close()` never settles. The supported client is
 * the one that works, and it is a dependency of the queue rather than a decision
 * about how this service talks to Redis.
 *
 * `maxRetriesPerRequest: null` is BullMQ's own requirement: a worker blocks on
 * the queue for seconds at a time, and ioredis's default retry budget cuts the
 * connection out from under it.
 *
 * Two connections, because a blocking one cannot be used for anything else.
 */
function connection(url: string): IORedis {
  const held = new IORedis(url, { maxRetriesPerRequest: null });
  // The errors this emits are the ones a caller already sees as a rejected
  // promise, and an unhandled `error` event would take the process down.
  held.on('error', () => undefined);
  return held;
}

export function createQueueScheduler(options: QueueOptions): Scheduler {
  const prefix = options.namespace ?? 'wikifake';

  const queue = new Queue<Alarm>(QUEUE, { connection: connection(options.url), prefix });

  const worker = new Worker<Alarm>(
    QUEUE,
    async (job) => {
      await options.onAlarm(job.data);
    },
    { connection: connection(options.url), prefix },
  );

  // A failed alarm is not a crashing process. It is one room that did not get
  // its transition, and BullMQ has already recorded the failure; an unhandled
  // `error` event on a Worker would take the service down with it.
  worker.on('error', () => undefined);
  queue.on('error', () => undefined);

  return {
    async arm(alarm, delayMs) {
      const id = alarmId(alarm.roomCode, alarm.kind, alarm.wave);

      // Removed first, then added. BullMQ ignores an `add` whose `jobId` already
      // exists, so arming a second round-end without this would keep the *old*
      // deadline — the round would end at the previous round's time.
      await queue.remove(id).catch(() => undefined);
      await queue.add(alarm.kind, alarm, {
        jobId: id,
        delay: delayMs,
        removeOnComplete: true,
        removeOnFail: true,
      });
    },

    async cancel(roomCode, kind, wave) {
      // A job that has already started cannot be removed, which is the right
      // outcome: the transition it carries is happening, and cancelling it
      // halfway would be worse than letting it finish.
      await queue.remove(alarmId(roomCode, kind, wave)).catch(() => undefined);
    },

    async close() {
      await worker.close();
      await queue.close();
    },
  };
}
