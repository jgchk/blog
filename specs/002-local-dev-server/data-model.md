# Data Model: Local Development Server

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Overview

The dev server introduces runtime state models for managing file watching, rendering, and live reload. It reuses existing `@blog/core` models (Article, FrontMatter) without modification.

---

## New Models

### DevServerConfig

Configuration for the development server instance.

```typescript
interface DevServerConfig {
  /** HTTP server port (default: 3000) */
  port: number;

  /** WebSocket server port (default: same as HTTP + 1, or shared) */
  wsPort?: number;

  /** Root directory of the blog repository */
  rootDir: string;

  /** Posts directory relative to rootDir (default: 'posts') */
  postsDir: string;

  /** Site package directory for templates/styles (default: 'packages/site') */
  siteDir: string;

  /** Whether to open browser on start (default: true) */
  open: boolean;

  /** Debounce delay for file changes in ms (default: 100) */
  debounceMs: number;
}
```

**Validation Rules**:
- `port` must be 1024-65535 (non-privileged ports)
- `rootDir` must exist and contain `posts/` directory
- `postsDir` must exist or will be created with warning

**Default Values**:
```typescript
const defaults: DevServerConfig = {
  port: 3000,
  rootDir: process.cwd(),
  postsDir: 'posts',
  siteDir: 'packages/site',
  open: true,
  debounceMs: 100,
};
```

---

### FileChangeEvent

Represents a file system change detected by the watcher.

```typescript
interface FileChangeEvent {
  /** Type of change */
  type: 'add' | 'change' | 'unlink';

  /** Absolute path to the changed file */
  path: string;

  /** File category for routing to appropriate handler */
  category: 'markdown' | 'css' | 'template' | 'asset';

  /** Extracted slug for markdown files (e.g., 'my-post') */
  slug?: string;

  /** Timestamp of the event */
  timestamp: Date;
}
```

**Derivation Rules**:
- `category: 'markdown'` when path matches `posts/**/index.md`
- `category: 'css'` when path matches `**/*.css`
- `category: 'template'` when path matches `**/templates/**/*.html`
- `category: 'asset'` when path matches `posts/**/*` (non-markdown)
- `slug` extracted from path: `posts/{slug}/index.md` → `slug`

---

### RenderedArticle

In-memory representation of a rendered article for serving.

```typescript
interface RenderedArticle {
  /** Article slug (URL path) */
  slug: string;

  /** Rendered HTML (article wrapped in template) */
  html: string;

  /** Article metadata from front matter */
  metadata: {
    title: string;
    date: Date;
    tags: string[];
    excerpt: string;
  };

  /** Assets associated with this article (images, etc.) */
  assets: string[];

  /** Last render timestamp */
  renderedAt: Date;

  /** Rendering errors (null if successful) */
  error: RenderError | null;
}
```

---

### RenderError

Structured error for display in console and browser.

```typescript
interface RenderError {
  /** Error type for categorization */
  type: 'parse' | 'frontmatter' | 'template' | 'unknown';

  /** Human-readable error message */
  message: string;

  /** Source file path */
  file: string;

  /** Line number if available */
  line?: number;

  /** Column number if available */
  column?: number;

  /** Stack trace for debugging */
  stack?: string;
}
```

**Error Message Requirements** (per SC-006):
- Must identify the file path
- Must identify the specific issue
- Must be displayed in console output

---

### WebSocketMessage

Messages sent between server and browser.

```typescript
// Server → Client
type ServerMessage =
  | { type: 'reload' }
  | { type: 'css'; path: string }
  | { type: 'error'; error: RenderError }
  | { type: 'connected' };

// Client → Server (for future extensibility)
type ClientMessage =
  | { type: 'ping' };
```

---

### DevServerState

Runtime state of the development server.

```typescript
interface DevServerState {
  /** Server status */
  status: 'starting' | 'running' | 'stopping' | 'stopped';

  /** All rendered articles keyed by slug */
  articles: Map<string, RenderedArticle>;

  /** Article index for wikilink resolution */
  articleIndex: ArticleIndex;

  /** Rendered index page HTML */
  indexHtml: string;

  /** Rendered archive page HTML */
  archiveHtml: string;

  /** Rendered tag pages keyed by tag slug */
  tagPages: Map<string, string>;

  /** Connected WebSocket clients */
  clients: Set<WebSocket>;

  /** Active file watcher */
  watcher: FSWatcher | null;

  /** Pending file changes (for debouncing) */
  pendingChanges: Map<string, FileChangeEvent>;

  /** Server start time */
  startedAt: Date | null;
}
```

**State Transitions**:
```
stopped → starting → running → stopping → stopped
                  ↑__________|
                  (error recovery)
```

---

## Reused Models from @blog/core

These existing models are used without modification:

### Article (from @blog/core)
```typescript
// Used for ArticleIndex population
interface Article {
  slug: string;
  title: string;
  date: Date;
  content: string;
  html: string;
  tags: string[];
  aliases: string[];
  draft: boolean;
  excerpt: string;
  sourcePath: string;
  updatedAt: Date;
}
```

### FrontMatter (from @blog/core)
```typescript
// Parsed from markdown files
interface FrontMatter {
  title: string;      // Required
  date: string;       // Required, YYYY-MM-DD
  tags?: string[];
  aliases?: string[];
  draft?: boolean;
  excerpt?: string;
}
```

---

## Entity Relationships

```
DevServerConfig
      │
      ▼
DevServerState ──────┬──────────────────┐
      │              │                  │
      ▼              ▼                  ▼
  articles       articleIndex       clients
 (Map<slug,      (ArticleIndex     (Set<WebSocket>)
  RenderedArticle>) from @blog/core)
      │
      ▼
RenderedArticle
      │
      ├── metadata (from FrontMatter)
      └── error (RenderError | null)

FileChangeEvent ──triggers──▶ Rendering ──updates──▶ DevServerState
                                 │
                                 ▼
                          WebSocketMessage ──sent to──▶ clients
```

---

## Validation Summary

| Model | Required Fields | Validation |
|-------|----------------|------------|
| DevServerConfig | port, rootDir | Port range, directory exists |
| FileChangeEvent | type, path, category, timestamp | Valid path, known category |
| RenderedArticle | slug, html, metadata, renderedAt | Non-empty slug and html |
| RenderError | type, message, file | Non-empty message and file |
| WebSocketMessage | type | Valid message type |
