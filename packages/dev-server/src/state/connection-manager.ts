import type { WebSocket } from 'ws';
import type { ServerMessage } from '../types.js';

/**
 * Manages WebSocket client connections.
 */
export class ConnectionManager {
  private clients: Set<WebSocket> = new Set();

  /**
   * Add a WebSocket client.
   */
  addClient(client: WebSocket): void {
    this.clients.add(client);
  }

  /**
   * Remove a WebSocket client.
   */
  removeClient(client: WebSocket): void {
    this.clients.delete(client);
  }

  /**
   * Get the number of connected clients.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected clients.
   */
  getClients(): Set<WebSocket> {
    return this.clients;
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(message: ServerMessage): void {
    const json = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(json);
      }
    }
  }

  /**
   * Remove all clients.
   */
  clear(): void {
    this.clients.clear();
  }
}
