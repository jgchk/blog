# Individual Tag Pages Implementation Status

**Date:** 2025-12-25
**Status:** Partially Implemented (Broken)

## Summary

The all tags page (`/tags/`) works correctly, but individual tag pages (`/tags/{slug}.html`) are not functioning in either the dev server or production builds.

## Investigation Findings

### Dev Server

**Location:** `packages/dev-server/src/server.ts:229-257`

The dev server has a route handler for individual tag pages, but it doesn't properly handle the `.html` extension:

```typescript
fastify.get<{ Params: { tag: string } }>('/tags/:tag', async (request, reply) => {
  const { tag } = request.params;
  // ...
  const matchedTag = allTags.find(
    (t) => t.toLowerCase() === tag.toLowerCase()
  );
  // ...
});
```

**Problem:** When requesting `/tags/getting-started.html`:
- The `:tag` parameter captures `getting-started.html` (with extension)
- The tag matching compares against `getting-started` (without extension)
- No match is found, resulting in a 404

**Template Reference:** The `tags.html` template generates links as `/tags/{{slug}}.html` (line 32), which is the expected URL pattern, but the route handler doesn't strip the `.html` suffix before matching.

| Component | Status | Notes |
|-----------|--------|-------|
| Route handler | Exists but broken | `/tags/:tag` doesn't strip `.html` |
| Renderer function | Works | `renderTagPage()` in `renderer.ts:270-311` |
| Template | Exists | `packages/site/src/templates/tag.html` |
| State/caching | Works | `state.tagPages` Map in `state.ts:21` |

### Production Renderer

**Location:** `packages/renderer/src/services/render-service.ts`

The production renderer is missing individual tag page generation entirely:

| Function | Status |
|----------|--------|
| `renderAllTagsPage()` | Exists (lines 266-288) |
| `renderTagPage()` | **Missing** |
| `publishTagPage()` | **Missing** |

**Problem:** The all-tags page is generated and links to `/tags/{slug}.html`, but those static HTML files are never created during the production build process.

### Templates

Both templates exist and are properly structured:

| Template | Location | Purpose |
|----------|----------|---------|
| `tags.html` | `packages/site/src/templates/tags.html` | All tags index page |
| `tag.html` | `packages/site/src/templates/tag.html` | Individual tag detail page |

The `tag.html` template expects the following context:
- `tagName` - Display name of the tag
- `tagSlug` - URL-safe slug
- `articleCount` - Number of articles with this tag
- `articles[]` - Array of article objects
- `year` - Current year for footer

## Required Fixes

### Fix 1: Dev Server Route Handler

**File:** `packages/dev-server/src/server.ts`

Strip the `.html` extension from the tag parameter before matching:

```typescript
fastify.get<{ Params: { tag: string } }>('/tags/:tag', async (request, reply) => {
  let { tag } = request.params;

  // Strip .html extension if present
  if (tag.endsWith('.html')) {
    tag = tag.slice(0, -5);
  }

  // ... rest of handler
});
```

### Fix 2: Production Renderer

**File:** `packages/renderer/src/services/render-service.ts`

Add functions to render and publish individual tag pages:

1. Add `renderTagPage(tagSlug: string, articles: Article[]): string`
   - Filter articles by tag
   - Compile `tag.html` template with Handlebars
   - Return rendered HTML

2. Add publishing logic in the main render workflow:
   - Extract all unique tags from articles
   - For each tag, call `renderTagPage()`
   - Write output to `tags/{slug}.html`

## Test Coverage

Existing E2E tests expect individual tag pages to work:

- `tag-navigation.spec.ts:46` - Tests `/tags/typescript.html` directly
- `all-tags.spec.ts:31-38` - Verifies links match `/tags/[\w-]+\.html` pattern

These tests would pass in a properly functioning dev server but would fail in production builds because the static files don't exist.

## Impact

| Scenario | Current Behavior |
|----------|------------------|
| Click tag link on all-tags page | 404 error |
| Click tag link on article page | 404 error |
| Direct navigation to `/tags/{slug}.html` | 404 error |
| Production deployment | Broken links, missing pages |

## Recommendations

1. **Priority:** Fix dev server route handler first (simple fix)
2. **Then:** Implement production renderer support
3. **Testing:** Ensure E2E tests pass after fixes
4. **Consider:** Adding integration tests specifically for tag page rendering
