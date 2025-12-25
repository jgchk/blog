# HTTP Route Contracts: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Date**: 2025-12-25

## Dev Server Routes

### GET /tags/:tag

Individual tag page route.

**Request**:
```
GET /tags/{tagSlug}.html HTTP/1.1
Host: localhost:3000
Accept: text/html
```

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `tag` | string | Tag slug with `.html` extension (e.g., `typescript.html`) |

**Processing**:
1. Strip `.html` extension from `tag` parameter
2. Normalize to lowercase
3. Look up tag in TagIndex
4. Render tag page with articles if found

**Success Response** (200 OK):
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>Tag: TypeScript</title></head>
<body>
  <h1>Tag: TypeScript</h1>
  <p>3 articles tagged with "TypeScript"</p>
  <section aria-label="Article list">
    <!-- Article entries -->
  </section>
</body>
</html>
```

**Error Response** (404 Not Found):
```
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<!-- Generic site 404 page -->
```

**Behavior Notes**:
- Case-insensitive: `/tags/TypeScript.html` and `/tags/typescript.html` return same content
- URL-encoded slugs: `/tags/c-plus-plus.html` decoded correctly
- Missing `.html` extension: Route does not match (handled by static file fallback)

### GET /tags/

All tags page (existing, no changes).

**Request**:
```
GET /tags/ HTTP/1.1
Host: localhost:3000
Accept: text/html
```

**Response** (200 OK):
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<body>
  <h1>All Tags</h1>
  <ul>
    <li><a href="/tags/typescript.html">TypeScript (5)</a></li>
    <!-- More tags -->
  </ul>
</body>
</html>
```

## Production Static Files

### Output File Structure

After production build completes:

```
s3://blog-bucket/
├── tags/
│   ├── index.html              # All tags page (existing)
│   ├── typescript.html         # NEW: Individual tag page
│   ├── getting-started.html    # NEW: Individual tag page
│   └── {slug}.html             # NEW: One per unique tag
└── articles/
    └── {slug}/
        └── index.html
```

### Static File Contract

**File**: `tags/{slug}.html`

**Content-Type**: `text/html; charset=utf-8`

**Cache-Control**: Same as existing pages (determined by CloudFront configuration)

**Content Requirements**:
- Valid HTML5 document
- Contains tag name as `<h1>` heading
- Contains article count
- Contains list of articles with links to `/articles/{slug}/`
- Contains navigation link back to `/tags/`

## Error Handling

| Scenario | Dev Server | Production |
|----------|------------|------------|
| Valid tag | 200 + tag page | Static HTML served |
| Unknown tag | 404 + site 404 page | CloudFront 404 behavior |
| Malformed URL | Fastify default handling | CloudFront default handling |
| Missing extension | Route not matched | S3 key not found |
