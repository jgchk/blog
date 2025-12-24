/**
 * Live reload client script that gets injected into HTML pages.
 * Per websocket-api.md specification.
 *
 * Handles:
 * - 'reload': Full page reload (content/template changes)
 * - 'css': Style-only update (no full reload)
 * - 'error': Display error in console
 * - 'connected': Log connection status
 */
export const CLIENT_SCRIPT = `(function() {
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = protocol + '//' + location.host + '/__dev/ws';

  var ws;
  var reconnectAttempts = 0;
  var maxReconnectAttempts = 10;
  var reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
      console.log('[Dev Server] Connected');
      reconnectAttempts = 0;
    };

    ws.onmessage = function(event) {
      var msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error('[Dev Server] Invalid message:', event.data);
        return;
      }

      switch (msg.type) {
        case 'connected':
          console.log('[Dev Server] Ready for live reload');
          break;

        case 'reload':
          console.log('[Dev Server] Reloading...');
          location.reload();
          break;

        case 'css':
          console.log('[Dev Server] Updating CSS:', msg.path);
          updateStylesheet(msg.path);
          break;

        case 'error':
          console.error('[Dev Server] Error in ' + msg.error.file + ':');
          console.error(msg.error.message);
          break;

        default:
          console.warn('[Dev Server] Unknown message type:', msg.type);
      }
    };

    ws.onclose = function() {
      console.log('[Dev Server] Disconnected');
      attemptReconnect();
    };

    ws.onerror = function(error) {
      console.error('[Dev Server] WebSocket error:', error);
    };
  }

  function attemptReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log('[Dev Server] Reconnecting (' + reconnectAttempts + '/' + maxReconnectAttempts + ')...');
      setTimeout(connect, reconnectDelay * reconnectAttempts);
    } else {
      console.error('[Dev Server] Max reconnection attempts reached');
    }
  }

  function updateStylesheet(path) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && (href.indexOf(path) !== -1 || path === '*')) {
        var url = new URL(href, location.origin);
        url.searchParams.set('_reload', Date.now().toString());
        link.setAttribute('href', url.toString());
      }
    });
  }

  // Start connection
  connect();
})();`;

/**
 * Get the client script as a string for serving via HTTP.
 */
export function getClientScript(): string {
  return CLIENT_SCRIPT;
}

/**
 * Inject the client script tag into HTML.
 * Inserts before the closing </body> tag.
 */
export function injectClientScript(html: string): string {
  const scriptTag = '<script src="/__dev/client.js"></script>';

  // Try to inject before </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${scriptTag}\n</body>`);
  }

  // If no </body>, append to end
  return html + scriptTag;
}
