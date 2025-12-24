import type { WebSocket } from 'ws';
import type { ServerMessage } from './types.js';
import { DevServerState } from './state.js';

/**
 * Broadcast a message to all connected WebSocket clients.
 * Per websocket-api.md specification.
 */
export function broadcast(state: DevServerState, message: ServerMessage): void {
  const messageStr = JSON.stringify(message);

  for (const client of state.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      try {
        client.send(messageStr);
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
        // Remove dead client
        state.removeClient(client);
      }
    }
  }
}

/**
 * Create a WebSocket handler for a client connection.
 * Used by the Fastify WebSocket plugin.
 */
export function createWebSocketHandler(
  socket: WebSocket,
  state: DevServerState
): void {
  // Add client to state
  state.addClient(socket);

  // Send connected message
  const connectedMsg: ServerMessage = { type: 'connected' };
  socket.send(JSON.stringify(connectedMsg));

  // Handle client messages
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'ping') {
        // Heartbeat - no response needed per spec
      }
    } catch {
      // Ignore invalid messages per spec
    }
  });

  // Handle disconnection
  socket.on('close', () => {
    state.removeClient(socket);
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error('WebSocket error:', err);
    state.removeClient(socket);
  });
}
