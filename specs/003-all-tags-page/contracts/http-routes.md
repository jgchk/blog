# HTTP Routes Contract: All Tags Page

**Feature**: 003-all-tags-page
**Date**: 2025-12-25

## Overview

This feature adds a single HTTP route to the dev-server. No external API contracts as this is an internal page.

## Routes

### GET /tags/

**Description**: All tags index page showing all tags with article counts.

**Handler Location**: `packages/dev-server/src/server.ts`

**Request**:
- Method: `GET`
- Path: `/tags/` (trailing slash handled by `ignoreTrailingSlash: true`)
- Parameters: None
- Body: None

**Response**:

| Status | Content-Type | Description |
|--------|--------------|-------------|
| 200 | `text/html; charset=utf-8` | Rendered all-tags page |
| 500 | `text/html; charset=utf-8` | Error page (rendering failure) |

**Headers (all responses)**:
```
Cache-Control: no-cache, no-store, must-revalidate
X-Dev-Server: blog-dev/1.0
```

**200 Response Body**: Full HTML page including:
- Document structure (`<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`)
- Navigation with link to home, archive, tags (current)
- Main content with:
  - `<h1>All Tags</h1>`
  - Total tag count
  - List of tags with counts and links
- Footer
- Injected live reload script (`/__dev/client.js`)

**500 Response Body**: Error page with message and link to home.

---

## URL Structure

| URL Pattern | Description | Example |
|-------------|-------------|---------|
| `/tags/` | All tags index | `/tags/` |
| `/tags/:slug.html` | Individual tag page (existing) | `/tags/typescript.html` |

**Note**: The all-tags page links to individual tag pages using the `.html` suffix pattern already established.

---

## Production Output

**Location**: `{output}/tags/index.html`

The production renderer will generate a static HTML file at this path, served via S3/CloudFront.

---

## Integration Points

### Internal Dependencies

1. **DevServerState.allTagsHtml**: Cached rendered HTML
2. **DevServerState.getAllArticles()**: Source data for tag aggregation
3. **TagIndex.buildFromArticles()**: Tag aggregation service
4. **renderAllTags()**: Template rendering function

### Template

- **File**: `packages/site/src/templates/tags.html`
- **Engine**: Handlebars
- **Variables**: `totalTags`, `tags[]`, `year`

---

## Example Response (200)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="All tags on the blog">
  <title>All Tags</title>
  <link rel="stylesheet" href="/assets/styles/main.css">
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header role="banner">
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/archive.html">Archive</a></li>
        <li><a href="/tags/" aria-current="page">Tags</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content" role="main">
    <h1>All Tags</h1>
    <p>3 tags across all articles</p>

    <nav aria-label="Tag cloud">
      <ul class="tag-cloud" role="list">
        <li>
          <a href="/tags/javascript.html" aria-label="JavaScript (5 articles)">
            JavaScript <span class="tag-count">(5)</span>
          </a>
        </li>
        <li>
          <a href="/tags/react.html" aria-label="React (3 articles)">
            React <span class="tag-count">(3)</span>
          </a>
        </li>
        <li>
          <a href="/tags/typescript.html" aria-label="TypeScript (12 articles)">
            TypeScript <span class="tag-count">(12)</span>
          </a>
        </li>
      </ul>
    </nav>
  </main>

  <footer role="contentinfo">
    <p>&copy; 2025 Blog. All rights reserved.</p>
  </footer>
  <script src="/__dev/client.js"></script>
</body>
</html>
```
