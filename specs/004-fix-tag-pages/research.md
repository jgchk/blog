# Research: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Date**: 2025-12-25

## Research Tasks

This feature is a bug fix with minimal unknowns. Research focused on understanding existing patterns to ensure consistency.

### 1. Dev Server Route Parameter Handling

**Context**: Need to strip `.html` extension from tag URL parameter.

**Finding**: Fastify route parameters capture the full path segment. For `/tags/:tag` matching `/tags/typescript.html`, the `tag` parameter contains `"typescript.html"`.

**Decision**: Strip `.html` suffix using simple string manipulation before tag matching.

**Rationale**:
- Fastify doesn't provide built-in extension stripping
- String `.replace(/\.html$/, '')` is idiomatic and clear
- Matches the URL pattern expectation from templates (`/tags/{slug}.html`)

**Alternatives Considered**:
- Separate route for `.html` paths: Rejected - adds unnecessary route duplication
- Regex route matching: Rejected - less readable, same outcome

### 2. Production Tag Page Generation Pattern

**Context**: Need to generate static HTML for each tag during production build.

**Finding**: Existing `renderAllTagsPage()` and `publishAllTagsPage()` methods in `render-service.ts` provide the pattern:
- Render method generates HTML using Handlebars template
- Publish method writes to S3 with appropriate content type
- Both follow the same signatures as article rendering

**Decision**: Implement `renderTagPage(tag, articles)` and `publishTagPage(tag, articles)` following the existing pattern.

**Rationale**:
- Consistency with existing codebase patterns
- Reuses existing template infrastructure
- No new dependencies required

**Alternatives Considered**:
- Batch all tag pages in single method: Rejected - less testable, inconsistent with article pattern
- Generate tag pages on-demand (Lambda@Edge): Rejected - over-engineering for static content

### 3. Tag Page Integration Point

**Context**: Where in the render workflow should tag pages be generated?

**Finding**: The `render-service.ts` has handlers triggered by S3 events (article changes). The all-tags page regeneration is triggered after article processing.

**Decision**: Generate all tag pages after the all-tags page generation, iterating through all unique tags from TagIndex.

**Rationale**:
- Ensures tag data is current when rendering
- Follows existing workflow pattern
- All tags rendered with consistent data snapshot

**Alternatives Considered**:
- Generate only changed tag pages: Rejected - adds complexity tracking which tags changed; premature optimization
- Separate Lambda for tag generation: Rejected - unnecessary infrastructure complexity

### 4. Case-Insensitive URL Matching

**Context**: FR-005 requires case-insensitive tag URL matching.

**Finding**: The dev server already implements case-insensitive matching using `toLowerCase()` comparison. TagIndex stores tags with normalized slugs.

**Decision**: Maintain existing pattern - normalize incoming URL parameter to lowercase before matching against tag slugs.

**Rationale**:
- Consistent with existing implementation
- TagIndex already uses lowercase slugs internally
- Simple and predictable behavior

**Alternatives Considered**:
- HTTP redirect to canonical URL: Rejected - adds complexity, unnecessary for SEO (static site)

## Summary

No significant unknowns or design decisions required. This is a well-scoped bug fix using established patterns:

1. **Dev server**: Add 1 line to strip `.html` extension
2. **Production**: Add ~50 lines following existing render/publish pattern
3. **Tests**: Leverage existing E2E test expectations

All research complete. No NEEDS CLARIFICATION items remain.
