# HTTP API Contract: Local Development Server

**Feature**: 002-local-dev-server
**Date**: 2025-12-24

## Overview

The dev server exposes a simple HTTP API for serving rendered blog content locally. All endpoints serve HTML/CSS/assets - there is no JSON API.

**Base URL**: `http://localhost:{port}` (default port: 3000)

---

## Endpoints

### GET /

**Description**: Serves the blog index page with all published articles.

**Response**:
- `200 OK` - HTML index page
- Content-Type: `text/html; charset=utf-8`

**Response Body**: Rendered index.html template with:
- List of all non-draft articles sorted by date (newest first)
- Article titles linked to individual article pages
- Article dates and excerpts

**Example**:
```
GET /
→ 200 OK
→ Content-Type: text/html; charset=utf-8
→ <!DOCTYPE html><html>... (rendered index page)
```

---

### GET /articles/{slug}

**Description**: Serves an individual article page.

**Path Parameters**:
- `slug` (string, required): Article identifier derived from folder name

**Response**:
- `200 OK` - Rendered article HTML
- `404 Not Found` - Article does not exist

**Response Headers**:
- Content-Type: `text/html; charset=utf-8`

**Response Body** (200): Rendered article.html template with:
- Article title, date, content
- Navigation links
- Tags

**Response Body** (404): Simple 404 error page

**Example**:
```
GET /articles/my-first-post
→ 200 OK
→ Content-Type: text/html; charset=utf-8
→ <!DOCTYPE html><html>... (rendered article)

GET /articles/nonexistent
→ 404 Not Found
→ Article not found: nonexistent
```

---

### GET /archive

**Description**: Serves the archive page with all articles chronologically.

**Response**:
- `200 OK` - HTML archive page
- Content-Type: `text/html; charset=utf-8`

---

### GET /tags/{tag}

**Description**: Serves a tag page with articles filtered by tag.

**Path Parameters**:
- `tag` (string, required): Tag slug

**Response**:
- `200 OK` - HTML tag page with matching articles
- `404 Not Found` - No articles with this tag

---

### GET /styles/{filename}

**Description**: Serves CSS files from the site package.

**Path Parameters**:
- `filename` (string, required): CSS filename (e.g., `main.css`)

**Response**:
- `200 OK` - CSS file content
- `404 Not Found` - File does not exist

**Response Headers**:
- Content-Type: `text/css; charset=utf-8`
- Cache-Control: `no-cache` (dev mode)

---

### GET /articles/{slug}/{asset}

**Description**: Serves static assets co-located with articles (images, etc.).

**Path Parameters**:
- `slug` (string, required): Article identifier
- `asset` (string, required): Asset filename (e.g., `hero.png`)

**Response**:
- `200 OK` - Asset content with appropriate MIME type
- `404 Not Found` - Asset does not exist

**Response Headers**:
- Content-Type: Inferred from file extension
- Cache-Control: `no-cache` (dev mode)

**Supported Asset Types**:
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`
- Documents: `.pdf`
- Other: Served as `application/octet-stream`

---

### GET /__dev/client.js

**Description**: Serves the live reload client script (injected into HTML pages).

**Response**:
- `200 OK` - JavaScript client code
- Content-Type: `application/javascript; charset=utf-8`

**Response Body**: Live reload WebSocket client that:
- Connects to WebSocket server
- Handles `reload`, `css`, and `error` messages
- Reconnects on disconnection

---

## Error Responses

All error responses return HTML for browser display:

### 404 Not Found
```html
<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
  <h1>404 Not Found</h1>
  <p>{resource} not found</p>
  <a href="/">← Back to home</a>
</body>
</html>
```

### 500 Internal Server Error
```html
<!DOCTYPE html>
<html>
<head><title>500 Error</title></head>
<body>
  <h1>Rendering Error</h1>
  <pre>{error details}</pre>
  <p>Check the console for details.</p>
</body>
</html>
```

---

## Response Headers (All Endpoints)

| Header | Value | Purpose |
|--------|-------|---------|
| Cache-Control | `no-cache, no-store, must-revalidate` | Disable caching in dev |
| X-Dev-Server | `blog-dev/1.0` | Identify dev server responses |

---

## URL Routing Summary

| Pattern | Handler | Description |
|---------|---------|-------------|
| `/` | indexHandler | Blog homepage |
| `/articles/:slug` | articleHandler | Individual article |
| `/articles/:slug/:asset` | assetHandler | Article assets |
| `/archive` | archiveHandler | Archive page |
| `/tags/:tag` | tagHandler | Tag filtered page |
| `/styles/:file` | staticHandler | CSS files |
| `/__dev/client.js` | devClientHandler | Live reload script |
