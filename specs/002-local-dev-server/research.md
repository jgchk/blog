# Research: Local Development Server

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Research Tasks

Based on Technical Context unknowns and technology choices:

1. HTTP Server framework selection (express vs fastify)
2. File watcher library (chokidar best practices)
3. WebSocket implementation for live reload
4. CSS hot reload patterns (style injection vs full reload)
5. Process cleanup patterns for Node.js

---

## 1. HTTP Server Framework

### Decision: Fastify

### Rationale
- **Performance**: Fastify is ~2x faster than Express for simple routing scenarios
- **TypeScript-first**: Better TypeScript support with built-in type definitions
- **Modern**: Uses async/await natively, no callback patterns
- **Static file serving**: `@fastify/static` plugin handles asset serving efficiently
- **Minimal footprint**: Smaller bundle size than Express ecosystem
- **Constitution alignment**: Principle IV (Minimal Complexity) - Fastify has fewer middleware layers

### Alternatives Considered
- **Express**: More popular, but older architecture, callback-heavy, larger ecosystem we don't need
- **Koa**: Good middleware system but less TypeScript support and static file handling
- **Native http module**: Too low-level, would require reimplementing routing and static serving

---

## 2. File Watcher

### Decision: chokidar

### Rationale
- **Industry standard**: Used by webpack, Vite, esbuild, and most Node.js dev tools
- **Cross-platform**: Handles macOS FSEvents, Linux inotify, Windows ReadDirectoryChangesW
- **Stable events**: Debounces and normalizes file system events across platforms
- **Glob support**: Can watch `posts/**/*.md` and `packages/site/src/styles/**/*.css` patterns
- **Ignored patterns**: Built-in support for ignoring node_modules, .git, etc.

### Alternatives Considered
- **Node.js fs.watch**: Unreliable cross-platform, doesn't report filenames consistently on macOS
- **Node.js fs.watchFile**: Polling-based, inefficient for many files
- **Parcel watcher (@parcel/watcher)**: Faster but more complex setup, overkill for ~50 files

### Best Practices
- Use `awaitWriteFinish` option to wait for file writes to complete before triggering
- Set appropriate `ignoreInitial: true` to avoid processing all files on startup
- Use `persistent: true` to keep the process running
- Debounce rapid changes (editor auto-save can trigger multiple events)

---

## 3. WebSocket Live Reload

### Decision: ws library with custom protocol

### Rationale
- **Lightweight**: `ws` is the most minimal WebSocket implementation for Node.js
- **No dependencies**: Zero runtime dependencies, small attack surface
- **Protocol flexibility**: Can implement simple `{ type: 'reload' | 'css', path?: string }` messages
- **Constitution alignment**: Principle IV - minimal complexity, no framework overhead

### Protocol Design
```typescript
// Server → Client messages
{ type: 'reload' }           // Full page reload (content changes)
{ type: 'css', path: string } // CSS-only update (style changes)
{ type: 'error', message: string } // Rendering error notification

// Client script (injected into HTML)
const ws = new WebSocket('ws://localhost:PORT');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'reload') location.reload();
  if (msg.type === 'css') updateStylesheet(msg.path);
};
```

### Alternatives Considered
- **Socket.io**: Too heavy, includes fallback transports we don't need (modern browsers only)
- **LiveReload protocol**: Standard but requires browser extension or more complex injection
- **Server-Sent Events (SSE)**: One-way only, simpler but can't get client acknowledgment

---

## 4. CSS Hot Reload Pattern

### Decision: Style injection via link[rel=stylesheet] manipulation

### Rationale
- **No full page reload**: Preserves scroll position and DOM state
- **Simple implementation**: Change `href` query param to bust cache
- **Browser-native**: Works in all modern browsers without JavaScript framework
- **Spec requirement**: FR-009 requires CSS updates without full page reload

### Implementation Pattern
```typescript
// Client-side (injected script)
function updateStylesheet(path: string) {
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href?.includes(path) || !path) {
      const url = new URL(href, location.origin);
      url.searchParams.set('_reload', Date.now().toString());
      link.setAttribute('href', url.toString());
    }
  });
}
```

### Alternatives Considered
- **CSS Modules HMR**: Overkill, requires build tooling we don't have
- **Full page reload**: Works but loses scroll position, violates FR-009
- **CSSOM injection**: More complex, harder to debug

---

## 5. Process Cleanup Patterns

### Decision: Signal handlers + child process tracking

### Rationale
- **Spec requirement**: FR-010 requires clean termination, SC-004 requires zero orphan processes
- **Graceful shutdown**: Close WebSocket connections, then HTTP server, then watcher
- **Signal handling**: Listen for SIGINT (Ctrl+C), SIGTERM, and process exit

### Implementation Pattern
```typescript
// Cleanup order matters
async function shutdown() {
  console.log('\nShutting down...');

  // 1. Stop accepting new connections
  watcher.close();

  // 2. Close WebSocket connections (notify clients)
  wsServer.clients.forEach(client => {
    client.close(1000, 'Server shutting down');
  });

  // 3. Close HTTP server
  await new Promise(resolve => httpServer.close(resolve));

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  // Synchronous final cleanup if needed
});
```

### Alternatives Considered
- **PM2/nodemon management**: External dependency, user must install separately
- **No cleanup**: Orphan processes, violates SC-004

---

## 6. Local Rendering Orchestration

### Decision: Reuse @blog/core services with in-memory storage

### Rationale
- **Constitution alignment**: Principle IV - reuse existing code, no duplication
- **Spec requirement**: FR-005 requires same rendering pipeline as production
- **Existing services available**:
  - `MarkdownParser` - markdown → HTML
  - `FrontMatterParser` - extract metadata
  - `ArticleIndex` - wikilink resolution
  - `ArticleValidator` - validation and error reporting

### Integration Pattern
```typescript
import { MarkdownParser, FrontMatterParser, ArticleIndex } from '@blog/core';

// Build article index on startup and after changes
const index = new ArticleIndex();
articles.forEach(a => index.add(a));

// Render with wikilink support
const parser = new MarkdownParser({ articleIndex: index });
const html = await parser.parseWithMetadata(markdown);
```

### Storage Approach
- **In-memory**: No need for file-based output during dev
- **Template rendering**: Read templates from `@blog/site`, render with Handlebars
- **Asset serving**: Serve directly from `posts/{slug}/` and `packages/site/src/styles/`

---

## Summary of Technology Stack

| Component | Choice | Package |
|-----------|--------|---------|
| HTTP Server | Fastify | `fastify`, `@fastify/static` |
| File Watcher | chokidar | `chokidar` |
| WebSocket | ws | `ws` |
| Markdown Rendering | Existing | `@blog/core` |
| Templates | Existing | `@blog/site` (Handlebars) |
| CSS Reload | Link manipulation | Built-in (injected script) |

**Total new dependencies**: 4 (`fastify`, `@fastify/static`, `chokidar`, `ws`)

All NEEDS CLARIFICATION items from Technical Context have been resolved.
