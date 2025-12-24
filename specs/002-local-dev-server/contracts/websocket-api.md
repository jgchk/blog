# WebSocket API Contract: Live Reload

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Overview

The dev server maintains a WebSocket connection with the browser for live reload functionality. This enables instant updates when files change without manual browser refresh.

**WebSocket URL**: `ws://localhost:{port}` (same port as HTTP server)

---

## Connection Lifecycle

### 1. Client Connection

Browser connects when page loads (via injected `__dev/client.js` script).

```
Client                          Server
   |                               |
   |-------- WS Connect --------->|
   |                               |
   |<------ { type: 'connected' } |
   |                               |
```

### 2. Active Connection

Server sends messages when files change. Client responds to reload instructions.

```
Client                          Server
   |                               |
   |  (file change detected)       |
   |<------ { type: 'reload' } ---|
   |                               |
   |  (browser reloads page)       |
   |                               |
```

### 3. Disconnection

Server closes connections gracefully on shutdown.

```
Client                          Server
   |                               |
   |  (server shutting down)       |
   |<------ WS Close (1000) ------|
   |                               |
   |  (client attempts reconnect)  |
   |                               |
```

---

## Message Types (Server → Client)

### connected

Sent immediately after WebSocket connection is established.

```typescript
{
  type: 'connected'
}
```

**Client Action**: Log connection status, ready to receive updates.

---

### reload

Sent when content changes require a full page reload.

**Triggers**:
- Markdown file added (`posts/*/index.md`)
- Markdown file modified
- Markdown file deleted
- Template file changed (`*.html`)

```typescript
{
  type: 'reload'
}
```

**Client Action**: Execute `location.reload()`.

---

### css

Sent when CSS files change, enabling style-only updates without full reload.

**Triggers**:
- CSS file modified (`packages/site/src/styles/*.css`)

```typescript
{
  type: 'css',
  path: string  // Relative path from site root, e.g., 'styles/main.css'
}
```

**Client Action**: Update stylesheet link href to bust cache:
```javascript
// Find matching stylesheet and force reload
const link = document.querySelector(`link[href*="${path}"]`);
if (link) {
  const url = new URL(link.href);
  url.searchParams.set('_reload', Date.now());
  link.href = url.toString();
}
```

---

### error

Sent when rendering fails, allowing error display without crashing.

**Triggers**:
- Markdown parsing error
- Front matter validation error
- Template rendering error

```typescript
{
  type: 'error',
  error: {
    type: 'parse' | 'frontmatter' | 'template' | 'unknown',
    message: string,
    file: string,
    line?: number,
    column?: number
  }
}
```

**Client Action**: Display error overlay or log to console:
```javascript
console.error(`[Dev Server Error] ${error.file}: ${error.message}`);
// Optionally show error overlay in browser
```

---

## Message Types (Client → Server)

### ping

Optional heartbeat message for connection health checking.

```typescript
{
  type: 'ping'
}
```

**Server Action**: No response required. Used for connection keep-alive.

---

## Client Script Implementation

The `/__dev/client.js` endpoint serves this script, which is injected into all HTML pages:

```javascript
(function() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}`;

  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Dev Server] Connected');
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'connected':
          console.log('[Dev Server] Ready for live reload');
          break;

        case 'reload':
          console.log('[Dev Server] Reloading...');
          location.reload();
          break;

        case 'css':
          console.log(`[Dev Server] Updating CSS: ${msg.path}`);
          updateStylesheet(msg.path);
          break;

        case 'error':
          console.error(`[Dev Server] Error in ${msg.error.file}:`);
          console.error(msg.error.message);
          break;
      }
    };

    ws.onclose = () => {
      console.log('[Dev Server] Disconnected');
      attemptReconnect();
    };

    ws.onerror = (error) => {
      console.error('[Dev Server] WebSocket error:', error);
    };
  }

  function attemptReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`[Dev Server] Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`);
      setTimeout(connect, reconnectDelay * reconnectAttempts);
    } else {
      console.error('[Dev Server] Max reconnection attempts reached');
    }
  }

  function updateStylesheet(path) {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.includes(path) || path === '*')) {
        const url = new URL(href, location.origin);
        url.searchParams.set('_reload', Date.now().toString());
        link.setAttribute('href', url.toString());
      }
    });
  }

  // Start connection
  connect();
})();
```

---

## Script Injection

The dev server injects the client script into all HTML responses:

```html
<!-- Injected before </body> -->
<script src="/__dev/client.js"></script>
</body>
```

**Injection Rules**:
- Only inject into HTML responses (Content-Type: text/html)
- Only inject in development mode
- Place script tag before closing `</body>` tag

---

## Performance Requirements

| Metric | Target | Rationale |
|--------|--------|-----------|
| Message latency | < 50ms | Near-instant feedback |
| Reconnection time | < 3s | Quick recovery from disconnection |
| Max clients | 10 | Single developer scenario |

---

## Error Handling

| Scenario | Server Behavior | Client Behavior |
|----------|-----------------|-----------------|
| Client disconnects | Remove from clients set | Attempt reconnect |
| Server crashes | N/A | Reconnect loop until server returns |
| Invalid message | Log warning, ignore | Log error, continue |
| Connection refused | N/A | Exponential backoff reconnect |
