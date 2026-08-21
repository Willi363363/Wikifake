import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoomSocket, roomSocketUrl } from '../socket';

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.listeners = {};
    FakeWebSocket.last = this;
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  emit(type, event) {
    (this.listeners[type] ?? []).forEach((handler) => handler(event));
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit('close', {});
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }
}

describe('roomSocketUrl', () => {
  it('encode le code et le pseudo', () => {
    expect(roomSocketUrl('AB12CD', 'Jean Luc')).toContain('/ws/AB12CD/Jean%20Luc');
  });
});

describe('createRoomSocket', () => {
  beforeEach(() => {
    global.WebSocket = FakeWebSocket;
  });

  it("met en file les messages émis avant l'ouverture", () => {
    const socket = createRoomSocket({ code: 'AAAAAA', playerName: 'a' });
    socket.send('ping', { x: 1 });
    expect(FakeWebSocket.last.sent).toEqual([]);
    FakeWebSocket.last.open();
    expect(JSON.parse(FakeWebSocket.last.sent[0])).toEqual({ type: 'ping', payload: { x: 1 } });
  });

  it('diffuse à tous les abonnés et permet le désabonnement', () => {
    const socket = createRoomSocket({ code: 'AAAAAA', playerName: 'a' });
    const first = vi.fn();
    const second = vi.fn();
    socket.subscribe(first);
    const off = socket.subscribe(second);

    FakeWebSocket.last.emit('message', { data: JSON.stringify({ type: 'x' }) });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    off();
    FakeWebSocket.last.emit('message', { data: JSON.stringify({ type: 'x' }) });
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignore un message non JSON sans casser', () => {
    const socket = createRoomSocket({ code: 'AAAAAA', playerName: 'a' });
    const listener = vi.fn();
    socket.subscribe(listener);
    expect(() =>
      FakeWebSocket.last.emit('message', { data: 'pas du json' }),
    ).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('distingue une fermeture volontaire d’une coupure', () => {
    const onClose = vi.fn();
    const socket = createRoomSocket({ code: 'AAAAAA', playerName: 'a', onClose });
    FakeWebSocket.last.open();
    socket.close();
    expect(onClose).toHaveBeenCalledWith({ intentional: true });

    const other = createRoomSocket({ code: 'BBBBBB', playerName: 'b', onClose });
    FakeWebSocket.last.open();
    FakeWebSocket.last.close();
    expect(onClose).toHaveBeenLastCalledWith({ intentional: false });
    expect(other.code).toBe('BBBBBB');
  });
});
