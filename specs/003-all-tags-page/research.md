# Research: All Tags Page

**Feature**: 003-all-tags-page
**Date**: 2025-12-25

## Overview

This feature has minimal research requirements because:
1. Template already exists (`partials/tag-list.html`)
2. Data service already exists (`TagIndex` in @blog/core)
3. E2E tests already defined (`all-tags.spec.ts`)
4. Pattern to follow is well-established (archive page, tag pages)

## Research Items

### R-001: Route Handler Pattern

**Question**: How should the `/tags/` route be implemented in the dev-server?

**Decision**: Follow the existing `/archive` route pattern in `server.ts:200-211`

**Rationale**:
- Consistent with existing codebase patterns
- Uses same caching strategy (check `state.allTagsHtml`, render if empty)
- Same error handling approach
- Same HTML injection for live reload

**Alternatives Considered**:
- Separate controller class: Rejected - over-engineering for single route
- Middleware approach: Rejected - doesn't match existing patterns

**Reference Code**:
```typescript
// Existing pattern from /archive route (server.ts:200-211)
fastify.get('/archive', async (request, reply) => {
  try {
    if (!state.archiveHtml) {
      const articles = state.getAllArticles();
      state.archiveHtml = await renderArchive(config, articles);
    }
    return sendHtml(reply, state.archiveHtml);
  } catch (err) {
    console.error('Error rendering archive:', err);
    return sendHtml(reply.status(500), render500(String(err)));
  }
});
```

---

### R-002: Tag Data Aggregation

**Question**: How should tags be collected and sorted for display?

**Decision**: Use existing `TagIndex.buildFromArticles()` then sort alphabetically for display

**Rationale**:
- `TagIndex` already aggregates tags with counts from articles
- FR-006 requires alphabetical sorting (not by count)
- `getAllTags()` returns sorted by count, need custom sort for alphabetical

**Alternatives Considered**:
- Create new service: Rejected - TagIndex provides all needed data
- Sort by count: Rejected - spec explicitly requires alphabetical (FR-006)

**Implementation Note**:
```typescript
const tagIndex = TagIndex.buildFromArticles(articles);
const sortedTags = tagIndex.tags.sort((a, b) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);
```

---

### R-003: Template Location

**Question**: Should the template stay in `partials/` or move to root templates?

**Decision**: Move from `partials/tag-list.html` to `tags.html` in root templates directory

**Rationale**:
- Partials are for fragments included in other templates
- This is a full page template (has `<!DOCTYPE html>`, `<html>`, etc.)
- Consistent with other page templates: `index.html`, `archive.html`, `tag.html`
- `loadTemplate(templatesDir, 'tags')` pattern expects root-level templates

**Alternatives Considered**:
- Keep in partials and adjust path: Rejected - semantically incorrect placement
- Create new template: Rejected - existing template is complete and correct

---

### R-004: Cache Invalidation

**Question**: When should the all-tags page cache be cleared?

**Decision**: Clear `allTagsHtml` whenever any article changes (add/modify/remove)

**Rationale**:
- Tag counts change when articles change
- Same behavior as `indexHtml` and `archiveHtml` caches
- Simple invalidation strategy that's always correct

**Reference**: Current watcher behavior clears `indexHtml`, `archiveHtml`, and `tagPages` on article changes.

---

### R-005: Empty State Handling

**Question**: What happens when no tags exist?

**Decision**: Template handles this with `{{#each tags}}` producing empty list; add "No tags yet" message

**Rationale**:
- FR-006a and edge case spec require message: "No tags yet. Check back after articles are published."
- Template needs conditional: `{{#if tags.length}}...{{else}}...{{/if}}`

**Implementation Note**: Template already has structure, just needs conditional wrapper.

---

### R-006: Production Renderer Integration

**Question**: How should production builds generate the all-tags page?

**Decision**: Add to existing render pipeline in `packages/renderer/src/services/render-service.ts`

**Rationale**:
- FR-002 requires `/tags/index.html` generation
- Should output to same S3 bucket structure as other pages
- Can reuse same Handlebars template and TagIndex logic

**Note**: Production renderer currently only handles individual articles. Index pages (home, archive, tags) may need separate implementation or future enhancement. For MVP, focus on dev-server first per incremental development principle.

---

## Accessibility Verification

**Question**: Does the existing template meet WCAG 2.1 AA?

**Finding**: Yes, template includes:
- Skip link: `<a href="#main-content" class="skip-link">Skip to main content</a>`
- Landmark roles: `role="banner"`, `role="main"`, `role="contentinfo"`
- ARIA labels: `aria-label="Main navigation"`, `aria-label="Tag cloud"`
- Current page indicator: `aria-current="page"` on Tags nav link
- Semantic structure: proper heading hierarchy (`<h1>`), list for tags (`<ul>`)
- Descriptive link labels: `aria-label="{{name}} ({{count}} articles)"`

**Verification**: E2E tests include semantic structure checks. Recommend adding axe-core integration test (SC-006).

---

## Summary

All research items resolved. No blockers identified. Implementation can proceed using established patterns.

| Item | Status | Blocker |
|------|--------|---------|
| R-001: Route Handler Pattern | ✅ Resolved | No |
| R-002: Tag Data Aggregation | ✅ Resolved | No |
| R-003: Template Location | ✅ Resolved | No |
| R-004: Cache Invalidation | ✅ Resolved | No |
| R-005: Empty State Handling | ✅ Resolved | No |
| R-006: Production Renderer | ✅ Resolved | No |
| Accessibility | ✅ Verified | No |
