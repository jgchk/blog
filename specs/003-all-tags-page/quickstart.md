# Quickstart: All Tags Page Implementation

**Feature**: 003-all-tags-page
**Date**: 2025-12-25

## Prerequisites

- Node.js 20.x
- pnpm installed
- Repository cloned and dependencies installed (`pnpm install`)

## Quick Verification

Run existing E2E tests (expect failures until implemented):

```bash
pnpm --filter @blog/site test:e2e tests/e2e/all-tags.spec.ts
```

## Implementation Summary

### Files to Modify

| File | Change |
|------|--------|
| `packages/site/src/templates/tags.html` | Create (move from partials/tag-list.html) |
| `packages/site/src/templates/partials/tag-list.html` | Delete after move |
| `packages/dev-server/src/state.ts` | Add `allTagsHtml` property |
| `packages/dev-server/src/renderer.ts` | Add `renderAllTags()` function |
| `packages/dev-server/src/server.ts` | Add `/tags` route handler |
| `packages/dev-server/src/watcher.ts` | Add `allTagsHtml` cache invalidation |

### Implementation Order

1. **Template Move**: `partials/tag-list.html` → `tags.html`
2. **State**: Add `allTagsHtml: string = ''` to `DevServerState`
3. **Renderer**: Add `renderAllTags()` following `renderArchive()` pattern
4. **Server**: Add `/tags` route following `/archive` pattern
5. **Watcher**: Clear `allTagsHtml` on article changes

## Key Patterns

### Renderer Function Pattern

```typescript
// In packages/dev-server/src/renderer.ts
export async function renderAllTags(
  config: DevServerConfig,
  articles: RenderedArticle[]
): Promise<string> {
  const paths = resolveConfigPaths(config);
  registerHelpers();

  // Build tag data from articles
  const tagIndex = TagIndex.buildFromArticles(/* convert articles */);

  // Sort alphabetically (FR-006)
  const sortedTags = tagIndex.tags.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  const template = loadTemplate(paths.templatesDir, 'tags');

  return template({
    totalTags: tagIndex.totalTags,
    tags: sortedTags.map(tag => ({
      slug: tag.slug,
      name: tag.name,
      count: tag.count,
    })),
    year: new Date().getFullYear(),
  });
}
```

### Route Handler Pattern

```typescript
// In packages/dev-server/src/server.ts
fastify.get('/tags', async (request, reply) => {
  try {
    if (!state.allTagsHtml) {
      const articles = state.getAllArticles();
      state.allTagsHtml = await renderAllTags(config, articles);
    }
    return sendHtml(reply, state.allTagsHtml);
  } catch (err) {
    console.error('Error rendering all tags:', err);
    return sendHtml(reply.status(500), render500(String(err)));
  }
});
```

## Verification Steps

1. Start dev server: `pnpm --filter @blog/dev-server dev`
2. Navigate to `http://localhost:3000/tags/`
3. Verify:
   - Page displays with heading "All Tags"
   - Tags listed alphabetically with counts
   - Each tag links to `/tags/{slug}.html`
   - Navigation shows Tags as current page
4. Run E2E tests: `pnpm --filter @blog/site test:e2e`

## Success Criteria Checklist

- [ ] `/tags/` returns 200 with all tags listed
- [ ] Tags sorted alphabetically (FR-006)
- [ ] Each tag shows count badge (FR-006a)
- [ ] Tag links navigate to `/tags/{slug}.html`
- [ ] Navigation link present on all pages (FR-009)
- [ ] Live reload works when articles change (FR-008)
- [ ] E2E tests pass (`all-tags.spec.ts`)
- [ ] Accessibility: semantic HTML, ARIA labels present
