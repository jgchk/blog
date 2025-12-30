import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/state/connection-manager.js';
import type { WebSocket } from 'ws';
import type { ServerMessage } from '../../src/types.js';

function createMockWebSocket(): WebSocket {
  return {
    send: vi.fn(),
    readyState: 1, // OPEN
    OPEN: 1,
  } as unknown as WebSocket;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe('addClient', () => {
    it('should add a client', () => {
      const client = createMockWebSocket();

      manager.addClient(client);

      expect(manager.clientCount).toBe(1);
    });

    it('should not add duplicate clients', () => {
      const client = createMockWebSocket();

      manager.addClient(client);
      manager.addClient(client);

      expect(manager.clientCount).toBe(1);
    });
  });

  describe('removeClient', () => {
    it('should remove a client', () => {
      const client = createMockWebSocket();
      manager.addClient(client);

      manager.removeClient(client);

      expect(manager.clientCount).toBe(0);
    });

    it('should handle removing non-existent client gracefully', () => {
      const client = createMockWebSocket();

      expect(() => manager.removeClient(client)).not.toThrow();
    });
  });

  describe('clientCount', () => {
    it('should return 0 when empty', () => {
      expect(manager.clientCount).toBe(0);
    });

    it('should return correct count', () => {
      manager.addClient(createMockWebSocket());
      manager.addClient(createMockWebSocket());

      expect(manager.clientCount).toBe(2);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connected clients', () => {
      const client1 = createMockWebSocket();
      const client2 = createMockWebSocket();
      manager.addClient(client1);
      manager.addClient(client2);

      const message: ServerMessage = { type: 'reload' };
      manager.broadcast(message);

      expect(client1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(client2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send to clients that are not open', () => {
      const openClient = createMockWebSocket();
      const closedClient = {
        ...createMockWebSocket(),
        readyState: 3, // CLOSED
      } as unknown as WebSocket;

      manager.addClient(openClient);
      manager.addClient(closedClient);

      const message: ServerMessage = { type: 'reload' };
      manager.broadcast(message);

      expect(openClient.send).toHaveBeenCalled();
      expect(closedClient.send).not.toHaveBeenCalled();
    });

    it('should do nothing when no clients', () => {
      const message: ServerMessage = { type: 'reload' };

      expect(() => manager.broadcast(message)).not.toThrow();
    });
  });

  describe('getClients', () => {
    it('should return empty set when no clients', () => {
      expect(manager.getClients()).toEqual(new Set());
    });

    it('should return all clients', () => {
      const client1 = createMockWebSocket();
      const client2 = createMockWebSocket();
      manager.addClient(client1);
      manager.addClient(client2);

      const clients = manager.getClients();

      expect(clients.size).toBe(2);
      expect(clients.has(client1)).toBe(true);
      expect(clients.has(client2)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all clients', () => {
      manager.addClient(createMockWebSocket());
      manager.addClient(createMockWebSocket());

      manager.clear();

      expect(manager.clientCount).toBe(0);
    });
  });
});
