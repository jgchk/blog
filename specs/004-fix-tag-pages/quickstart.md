# Quickstart: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Date**: 2025-12-25

## Prerequisites

```bash
# Ensure you're on the feature branch
git checkout 004-fix-tag-pages

# Install dependencies
pnpm install

# Verify existing tests (expect some failures for tag navigation)
pnpm test
```

## Development Workflow

### 1. Start Dev Server

```bash
# From repo root
pnpm --filter @blog/dev-server dev

# Server runs at http://localhost:3000
```

### 2. Verify Current Bug

```bash
# This should 404 (current bug)
curl -I http://localhost:3000/tags/typescript.html

# This works (all-tags page)
curl -I http://localhost:3000/tags/
```

### 3. Run Existing Tests

```bash
# Unit tests (should pass)
pnpm --filter @blog/core test
pnpm --filter @blog/dev-server test

# E2E tests (tag navigation tests will fail until fix applied)
pnpm --filter @blog/site test:e2e
```

## Implementation Order

### Fix 1: Dev Server Route

**File**: `packages/dev-server/src/server.ts`

**Location**: Route handler for `/tags/:tag` (~line 229)

**Change**:
```typescript
// Before (line ~231)
const { tag } = request.params;
const matchedTag = allTags.find(...)

// After
const { tag } = request.params;
const tagSlug = tag.replace(/\.html$/, '');  // Add this line
const matchedTag = allTags.find(
  (t) => t.toLowerCase() === tagSlug.toLowerCase()  // Use tagSlug
);
```

**Verify**:
```bash
# Restart dev server, then:
curl http://localhost:3000/tags/typescript.html
# Should return HTML with tag page content
```

### Fix 2: Production Renderer

**File**: `packages/renderer/src/services/render-service.ts`

**Add Methods**:
1. `renderTagPage(tag, articles)` - Generate HTML using tag.html template
2. `publishTagPage(tag, articles)` - Write to S3
3. `publishAllTagPages(tagIndex, articles)` - Iterate and publish all

**Integration Point**: Call `publishAllTagPages` after `publishAllTagsPage` in the render workflow.

**Test**:
```bash
# Run renderer tests
pnpm --filter @blog/renderer test

# Build and inspect output
pnpm --filter @blog/renderer build
# Check that tags/*.html files are generated
```

## Verification Checklist

- [ ] Dev server: `/tags/typescript.html` returns 200
- [ ] Dev server: `/tags/nonexistent.html` returns 404
- [ ] Dev server: `/tags/TypeScript.html` returns same as lowercase
- [ ] Production: `tags/typescript.html` file exists after build
- [ ] Production: One `.html` file per unique tag in output
- [ ] E2E tests: `all-tags.spec.ts` passes
- [ ] E2E tests: `tag-navigation.spec.ts` passes

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/dev-server/src/server.ts` | Route handling (FIX) |
| `packages/dev-server/src/renderer.ts` | Template rendering (existing) |
| `packages/renderer/src/services/render-service.ts` | Production render (ADD methods) |
| `packages/core/src/services/tag-index.ts` | Tag data (existing) |
| `packages/site/src/templates/tag.html` | Template (existing) |
| `packages/site/tests/e2e/tag-navigation.spec.ts` | E2E tests (existing) |

## Troubleshooting

**Issue**: Tag page returns 404 despite fix
- Check that tag exists in `state.tagIndex`
- Verify extension stripping: log `tagSlug` value
- Ensure case-insensitive comparison is working

**Issue**: Production build missing tag files
- Verify `publishAllTagPages` is called in handler
- Check S3 bucket permissions
- Inspect CloudWatch logs for errors

**Issue**: Template rendering errors
- Verify tag.html template exists
- Check template context shape matches expected
- Ensure `isPlural` helper is registered
