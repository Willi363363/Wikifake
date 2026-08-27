// What a service needs, and what it hands back.
//
// Split out of `server.ts` at step 10.11, when the file crossed the 500-line
// cap `scripts/checks.sh` enforces. Not an arbitrary cut: these two interfaces
// are the service's *contract* — every collaborator it has to be given, and
// every door it opens — while `server.ts` is the one implementation of it. A
// reader asking "what does this service depend on" now has one file to read,
// and it is a hundred lines rather than five.
//
// Nothing here imports an implementation, so a test that wants to describe a
// fake service can import this alone.
import type { Bus } from './bus.js';
import type { Registry } from './connections.js';
import type { RoundSource } from './generation.js';
import type { OriginPolicy } from './origins.js';
import type { RoomStore } from './rooms/store.js';
import type { TokenStore } from './rooms/tokens.js';
import type { Intervals } from './throttle.js';
import type { OnAlarm, Scheduler } from './timers/scheduler.js';

export interface ServiceOptions {
  readonly origins: OriginPolicy;
  /**
   * Whether this room exists. Injected: the room lives in Postgres since 4.8,
   * and a transport that opened a connection to `@wikifake/db` would be a
   * transport nobody can test without one.
   */
  roomExists(roomCode: string): Promise<boolean>;
  /**
   * C1.8, D4 — this room is over: forget the row that says it exists.
   *
   * Called on both ends of a room's life — its last player evicted, and its idle
   * alarm ringing an hour after anybody touched it. Redis forgets the state on
   * its own, under the same revision guard as a write; Postgres does not, and a
   * code nobody reaps is a code that can never be drawn again and a socket a
   * stranger can still open on a room nobody is in.
   *
   * Required, and injected like `roomExists`: a service that silently never
   * reaps is exactly the defect, and an optional callback is one a deployment
   * can forget.
   */
  closeRoom(roomCode: string): Promise<void>;
  /**
   * Where the room's state lives. Redis, since 5.2 — never this process.
   *
   * Injected for the same reason as everything else here: a transport that
   * opened its own connection would be a transport nobody can test without one.
   */
  readonly rooms: RoomStore;
  /**
   * The channel every instance talks over. One per room.
   *
   * Since 5.3 nothing is sent straight to a socket: an effect is published, and
   * whichever instances hold sockets for that room deliver it. The publisher
   * hears its own messages, so delivery has exactly one path.
   */
  readonly bus: Bus;
  /** Keys and channels are namespaced so two deployments do not share rooms. */
  readonly namespace?: string;
  /** How much a socket may have queued before it is cut. Lowered by the tests. */
  readonly budgetBytes?: number;
  /**
   * D4 — what makes a round end when nobody ends it.
   *
   * A factory rather than an instance: what an alarm does is settle an event
   * against this service's own room, so the handler cannot exist before the
   * service does. Closing it is the service's job in return.
   */
  readonly scheduler: (onAlarm: OnAlarm) => Scheduler;
  /** How long a room with nothing happening in it survives. Shortened by tests. */
  readonly idleSeconds?: number;
  /** Which item a wave draws. Pinned by the tests; random in production. */
  readonly pick?: (upperBound: number) => number;
  /**
   * What time it is, in milliseconds since the epoch.
   *
   * A parameter for the same reason `pick` is: a round's time bonus depends on
   * how long the player took, so a test asserting one against the wall clock
   * asserts how fast the machine was. Production passes `Date.now`.
   */
  readonly now?: () => number;
  /** D5 — who is entitled to reclaim a nickname whose socket dropped. */
  readonly tokens: TokenStore;
  /**
   * C5.5, D6 — how often one socket may send `cursor` and `live_score`.
   *
   * Widened by the tests, where the point is that a burst is cut rather than
   * how fast the limit is: at the production interval a flood and its throttled
   * remainder differ by a handful of frames and a slow machine.
   */
  readonly throttleMs?: Partial<Intervals>;
  /**
   * D5 — how long a dropped player keeps their seat, in seconds.
   *
   * Long enough for a lift, a tunnel or a laptop lid; short enough that a room
   * is not held by somebody who has closed the tab. Shortened by the tests.
   */
  readonly graceSeconds?: number;
  /**
   * D3 — what answers `generate_article`.
   *
   * The effect the reducer emits when a topic has been picked, and the only
   * thing that can lead to `article_ready` — which is the only way into a round.
   * Injected, so the service is testable with the model and Wikipedia mocked.
   */
  readonly articles: RoundSource;
}

export interface Service {
  /** @param port 0 lets the OS choose, which is what a test wants. */
  listen(port: number): Promise<number>;
  close(): Promise<void>;
  /** The sockets this instance holds. Read by the tests, and by 5.3. */
  readonly connections: Registry;
  /**
   * Settles an event that did not come from a socket.
   *
   * Two of the reducer's events arrive from outside the socket loop by design:
   * `article_ready` and `article_failed`, which answer the `generate_article`
   * effect. The pipeline that will send them is step 5.8; this is the door it
   * comes through, and it is the same door an alarm uses.
   */
  settle(roomCode: string, event: Parameters<RoomStore['apply']>[1]): Promise<void>;
}
