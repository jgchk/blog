# CLI Interface Contract: Dev Server Command

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Overview

The dev server is started via a single CLI command, fulfilling FR-008 (single command startup).

---

## Command

```bash
pnpm dev
```

Or directly:
```bash
pnpm --filter @blog/dev-server start
```

---

## Options

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--port` | `-p` | number | 3000 | HTTP server port |
| `--no-open` | | boolean | false | Don't open browser on start |
| `--help` | `-h` | | | Show help message |

---

## Examples

```bash
# Start with defaults (port 3000, opens browser)
pnpm dev

# Start on custom port
pnpm dev --port 8080
pnpm dev -p 8080

# Start without opening browser
pnpm dev --no-open

# Combine options
pnpm dev -p 4000 --no-open
```

---

## Output

### Startup Success

```
🚀 Blog dev server starting...

  Watching:
    → posts/
    → packages/site/src/styles/
    → packages/site/src/templates/

  Found 5 articles

✓ Server ready in 847ms

  Local:   http://localhost:3000
  Network: http://192.168.1.100:3000

  Press Ctrl+C to stop
```

### File Change Events

```
[12:34:56] Changed: posts/my-post/index.md
[12:34:56] Rendered: my-post (234ms)
[12:34:56] Reloading browsers...

[12:35:10] Changed: packages/site/src/styles/main.css
[12:35:10] Updating CSS in browsers...

[12:36:00] Added: posts/new-post/index.md
[12:36:00] Rendered: new-post (312ms)
[12:36:00] Reloading browsers...

[12:37:00] Deleted: posts/old-post/index.md
[12:37:00] Removed: old-post
[12:37:00] Reloading browsers...
```

### Rendering Errors

```
[12:38:00] Changed: posts/broken-post/index.md
[12:38:00] ✗ Error in posts/broken-post/index.md:
           Front matter is missing required field: title
           Skipping article, other content still available.
```

### Shutdown

```
^C
Shutting down...
  ✓ Closed 1 browser connection
  ✓ Stopped file watcher
  ✓ HTTP server closed

Goodbye!
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean shutdown (Ctrl+C or SIGTERM) |
| 1 | Startup error (port in use, missing posts dir, etc.) |

---

## Error Messages

### Port Already in Use

```
✗ Port 3000 is already in use

  Try:
    pnpm dev --port 3001

  Or find the process:
    lsof -i :3000
```

### Posts Directory Missing

```
✗ Posts directory not found: /path/to/blog/posts

  Create the directory:
    mkdir posts

  Or check you're in the blog repository root.
```

### Invalid Port

```
✗ Invalid port: abc

  Port must be a number between 1024 and 65535.
```

---

## Integration with package.json

Root `package.json`:
```json
{
  "scripts": {
    "dev": "pnpm --filter @blog/dev-server start"
  }
}
```

`packages/dev-server/package.json`:
```json
{
  "name": "@blog/dev-server",
  "bin": {
    "blog-dev": "./dist/cli.js"
  },
  "scripts": {
    "start": "tsx src/cli.ts",
    "build": "esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js"
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port (overridden by --port) |
| `NO_COLOR` | - | Disable colored output |
| `DEBUG` | - | Enable debug logging |

---

## Signal Handling

| Signal | Action |
|--------|--------|
| SIGINT (Ctrl+C) | Graceful shutdown |
| SIGTERM | Graceful shutdown |
| SIGHUP | Ignored (no reload needed) |
