// 5.1's criteria, against a real server on a real port with a real client.
//
// Every one of them is a wire fact: a close code, a message arriving *before* a
// close, a connection that survives a bad frame, a nickname that only arrives
// intact because it was encoded. A mocked handshake would prove the mock.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createOriginPolicy } from './origins.js';
import { createService, type Service, type ServiceOptions } from './server.js';
import { open, until } from './testing/client.js';
import {
  CLOSE_MESSAGE_TOO_BIG,
  CLOSE_POLICY_VIOLATION,
  MAX_FRAME_CHARS,
} from './frames.js';
import type { Connection } from './connections.js';
import type { IncomingMessage } from '@wikifake/protocol';

const ROOM = 'A1B2C3';
const APP = 'https://wikifake.example';

interface Delivered {
  readonly connection: Connection;
  readonly message: IncomingMessage;
}

describe('5.1 — the transport', () => {
  let service: Service;
  let port: number;
  let delivered: Delivered[];

  const start = async (overrides: Partial<ServiceOptions> = {}): Promise<void> => {
    delivered = [];
    service = createService({
      origins: createOriginPolicy([APP]),
      roomExists: (roomCode) => Promise.resolve(roomCode === ROOM),
      onMessage: (connection, message) => delivered.push({ connection, message }),
      ...overrides,
    });
    port = await service.listen(0);
  };

  beforeEach(async () => {
    await start();
  });

  afterEach(async () => {
    await service.close();
  });

  /** The path a browser would build for this nickname. */
  const pathFor = (name: string, room = ROOM): string =>
    `/ws/${room}/${encodeURIComponent(name)}`;

  describe('C5.1 — the nickname', () => {
    // The criterion. The server's own regex has always allowed spaces and
    // accented letters; the current client interpolates the raw name into the
    // path, so the nickname either does not arrive or arrives mangled.
    it('accepts a nickname with a space, through the encoded URL', async () => {
      const client = await open(port, pathFor('Élise Dupont'));

      expect(client.closedWith()).toBeUndefined();
      expect(service.connections.holds(ROOM, 'Élise Dupont')).toBe(true);
      client.close();
    });

    it('refuses a nickname the contract does not allow, and says why first', async () => {
      const client = await open(port, pathFor('a'.repeat(40)));
      await client.waitForMessages(1);

      // C5.1 — the message leaves **before** the close. A socket closed without
      // a word is indistinguishable from a network failure, and the player is
      // shown "connection lost" for what was a rejected nickname.
      expect(client.received[0]).toMatchObject({ type: 'error', code: 'invalid_name' });
      expect(await client.closed()).toBe(CLOSE_POLICY_VIOLATION);
    });

    it('refuses a nickname made of characters the contract forbids', async () => {
      const client = await open(port, pathFor('<script>'));
      await client.waitForMessages(1);

      expect(client.received[0]).toMatchObject({ code: 'invalid_name' });
    });

    it('refuses an escape that is not one, rather than falling over', async () => {
      const client = await open(port, `/ws/${ROOM}/%zz`);
      await client.waitForMessages(1);

      expect(client.received[0]).toMatchObject({ code: 'invalid_name' });
      expect(await client.closed()).toBe(CLOSE_POLICY_VIOLATION);
    });
  });

  describe('the room', () => {
    it('refuses a room that does not exist', async () => {
      const client = await open(port, pathFor('ada', 'ZZZZZZ'));
      await client.waitForMessages(1);

      expect(client.received[0]).toMatchObject({
        type: 'error',
        code: 'room_not_found',
      });
      expect(await client.closed()).toBe(CLOSE_POLICY_VIOLATION);
    });

    it('refuses a code that is not a room code at all', async () => {
      const client = await open(port, pathFor('ada', 'nope'));
      await client.waitForMessages(1);

      expect(client.received[0]).toMatchObject({ code: 'room_not_found' });
    });
  });

  describe('C5.2 — a connected homonym', () => {
    // The criterion. Two players under one nickname means the second takes over
    // the first one's session.
    it('is refused, and the player already in place is untouched', async () => {
      const first = await open(port, pathFor('ada'));
      expect(service.connections.holds(ROOM, 'ada')).toBe(true);

      const second = await open(port, pathFor('ada'));
      await second.waitForMessages(1);

      expect(second.received[0]).toMatchObject({ type: 'error', code: 'name_taken' });
      expect(await second.closed()).toBe(CLOSE_POLICY_VIOLATION);

      // The first socket is still open, still registered, and was told nothing.
      expect(first.closedWith()).toBeUndefined();
      expect(first.received).toEqual([]);
      expect(service.connections.size).toBe(1);
      first.close();
    });

    it('frees the nickname once the first socket closes', async () => {
      const first = await open(port, pathFor('ada'));
      first.close();
      await first.closed();

      const second = await open(port, pathFor('ada'));
      expect(second.closedWith()).toBeUndefined();
      second.close();
    });

    it('lets the same nickname into two different rooms', async () => {
      await start({ roomExists: () => Promise.resolve(true) });

      const here = await open(port, pathFor('ada', 'A1B2C3'));
      const there = await open(port, pathFor('ada', 'D4E5F6'));

      expect(here.closedWith()).toBeUndefined();
      expect(there.closedWith()).toBeUndefined();
      expect(service.connections.size).toBe(2);
      here.close();
      there.close();
    });
  });

  describe('C5.3 — what a frame may be', () => {
    // The criterion. A client that sent one bad frame is a client that will send
    // a good one next; closing on it drops a player for a dropped byte.
    it('answers bad_json and keeps the connection', async () => {
      const client = await open(port, pathFor('ada'));

      client.send('{ not json');
      await client.waitForMessages(1);
      expect(client.received[0]).toMatchObject({ type: 'error', code: 'bad_json' });
      expect(client.closedWith()).toBeUndefined();

      // Still usable: the next frame is handled normally.
      client.send({ type: 'get_lobby' });
      await until(() => delivered.length === 1, 'the next frame to be handled');
      expect(delivered.map((each) => each.message.type)).toEqual(['get_lobby']);
      expect(client.closedWith()).toBeUndefined();
      client.close();
    });

    it('answers bad_json to JSON that is not a message', async () => {
      const client = await open(port, pathFor('ada'));

      client.send('[1, 2, 3]');
      await client.waitForMessages(1);
      expect(client.received[0]).toMatchObject({ code: 'bad_json' });
      client.close();
    });

    // A known type with a malformed payload is a client we understand sending
    // rubbish, and it is told so — unlike an unknown type, below.
    it('answers bad_json to a known message the schema refuses', async () => {
      const client = await open(port, pathFor('ada'));

      client.send({ type: 'submit_theme', topic: '' });
      await client.waitForMessages(1);
      expect(client.received[0]).toMatchObject({ code: 'bad_json' });
      expect(delivered).toEqual([]);
      client.close();
    });

    // The criterion. Silence rather than an error: a client one version ahead
    // would otherwise be flooded with rejections for a message it is entitled to
    // try, and a client one version behind would learn nothing from them.
    it('ignores an unknown type in silence', async () => {
      const client = await open(port, pathFor('ada'));

      client.send({ type: 'teleport', to: 'the moon' });
      client.send({ type: 'get_lobby' });
      // The known frame is sent second, so waiting for it to arrive proves the
      // unknown one was already dealt with — and dealt with in silence.
      await until(() => delivered.length > 0, 'the known frame to be handled');

      expect(delivered).toHaveLength(1);
      expect(client.received).toEqual([]);
      expect(client.closedWith()).toBeUndefined();
      client.close();
    });

    it('hands the handler the decoded message, with its defaults applied', async () => {
      const client = await open(port, pathFor('ada'));

      client.send({ type: 'set_ready' });
      await until(() => delivered.length === 1, 'the frame to be handled');

      const [first] = delivered;
      expect(first?.connection.playerName).toBe('ada');
      expect(first?.message).toMatchObject({ type: 'set_ready', ready: true });
      client.close();
    });
  });

  describe('C5.7 — a frame beyond 64,000 characters', () => {
    // The criterion. Not a move in a game: the socket closes with 1009.
    it('closes with 1009, without answering', async () => {
      const client = await open(port, pathFor('ada'));

      client.send(JSON.stringify({ type: 'chat_message', content: 'x'.repeat(70_000) }));

      expect(await client.closed()).toBe(CLOSE_MESSAGE_TOO_BIG);
      expect(client.received).toEqual([]);
      expect(delivered).toEqual([]);
    });

    it('lets a frame just under the limit through', async () => {
      const client = await open(port, pathFor('ada'));

      // Under the frame limit but over the chat cap: `bad_json`, not a close.
      // The two limits are different rules, and the frame one is about volume.
      const payload = JSON.stringify({
        type: 'chat_message',
        content: 'x'.repeat(MAX_FRAME_CHARS - 100),
      });
      expect(payload.length).toBeLessThanOrEqual(MAX_FRAME_CHARS);

      client.send(payload);
      await client.waitForMessages(1);
      expect(client.received[0]).toMatchObject({ code: 'bad_json' });
      expect(client.closedWith()).toBeUndefined();
      client.close();
    });
  });

  describe('the origins', () => {
    // The pitfall the phase names: two hosting providers, so the socket crosses
    // an origin boundary the single container never had. A WebSocket is not
    // protected by CORS — the browser sends the handshake whatever the origin,
    // and only the server can refuse it.
    it('accepts the app’s own origin', async () => {
      const client = await open(port, pathFor('ada'), { origin: APP });
      expect(client.closedWith()).toBeUndefined();
      client.close();
    });

    it('refuses another origin before the upgrade', async () => {
      await expect(
        open(port, pathFor('ada'), { origin: 'https://elsewhere.example' }),
      ).rejects.toThrow();
      expect(service.connections.size).toBe(0);
    });

    it('accepts a handshake with no origin at all', async () => {
      // Not a browser: a probe, a protocol test, a native client. Browsers always
      // send one, so its absence cannot be used to bypass the list.
      const client = await open(port, pathFor('ada'));
      expect(client.closedWith()).toBeUndefined();
      client.close();
    });
  });

  describe('C7.1 — the probe the platform reads', () => {
    it('answers exactly {"status":"alive"}', async () => {
      const response = await fetch(`http://127.0.0.1:${String(port)}/ping`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'alive' });
    });
  });
});
