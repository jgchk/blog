# Quickstart: Local Development Server

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Prerequisites

- Node.js 20.x or later
- pnpm 8.x or later
- Git

## Getting Started

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd blog

# Install dependencies
pnpm install
```

### 2. Start the Dev Server

```bash
pnpm dev
```

The server starts and opens your browser to `http://localhost:3000`.

### 3. Create Your First Post

Create a new article in the `posts/` directory:

```bash
mkdir posts/hello-world
```

Create `posts/hello-world/index.md`:

```markdown
---
title: Hello World
date: 2025-12-24
tags:
  - welcome
---

# Hello World

This is my first blog post!
```

Save the file - the browser automatically updates to show your new post.

## Development Workflow

### Writing Content

1. Create a folder: `posts/{your-slug}/`
2. Add `index.md` with front matter (title, date required)
3. Save - browser refreshes automatically

### Adding Images

1. Place images in your post folder: `posts/my-post/hero.png`
2. Reference in markdown: `![Alt text](hero.png)`
3. Save - image appears instantly

### Styling Changes

1. Edit `packages/site/src/styles/main.css`
2. Save - styles update without page reload (preserves scroll position)

### Cross-Linking

Link between posts using wikilinks:

```markdown
Check out my [[other-post]] for more details.
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (default port 3000) |
| `pnpm dev -p 8080` | Start on custom port |
| `pnpm dev --no-open` | Start without opening browser |
| `pnpm test` | Run all tests |
| `pnpm lint` | Check code style |

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
pnpm dev -p 3001

# Or find what's using port 3000
lsof -i :3000
```

### Changes Not Showing

1. Check the terminal for error messages
2. Verify your markdown has valid front matter
3. Try a full page refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Invalid Front Matter

The server shows errors in the terminal. Common issues:

- Missing `title` field (required)
- Missing `date` field (required)
- Invalid date format (use `YYYY-MM-DD`)

Example error:
```
✗ Error in posts/my-post/index.md:
  Front matter is missing required field: title
```

### WebSocket Disconnected

If you see `[Dev Server] Disconnected` in the browser console:

1. Check if the dev server is still running
2. The client will auto-reconnect when the server is available
3. If issues persist, restart the dev server

## Project Structure

```
blog/
├── posts/                    # Your content goes here
│   ├── hello-world/
│   │   ├── index.md         # Article content
│   │   └── hero.png         # Co-located assets
│   └── another-post/
│       └── index.md
├── packages/
│   ├── core/                # Markdown processing (don't modify)
│   ├── dev-server/          # Dev server (this feature)
│   ├── site/
│   │   └── src/
│   │       ├── templates/   # HTML templates
│   │       └── styles/      # CSS (edit for styling)
│   └── ...
└── specs/                   # Feature specifications
```

## What Gets Watched

The dev server watches these locations for changes:

| Path | File Types | Action on Change |
|------|------------|------------------|
| `posts/` | `*.md` | Re-render article, reload page |
| `posts/` | images, etc. | Reload page (asset refresh) |
| `packages/site/src/styles/` | `*.css` | Update styles (no reload) |
| `packages/site/src/templates/` | `*.html` | Re-render all, reload page |

## Next Steps

- Read the [spec.md](./spec.md) for detailed requirements
- Check [data-model.md](./data-model.md) for data structures
- Review [contracts/](./contracts/) for API documentation
