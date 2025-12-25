# Implementation Plan: All Tags Page

**Branch**: `003-all-tags-page` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-all-tags-page/spec.md`

## Summary

Implement the missing all tags page (tag index) at `/tags/` route for both dev-server and production renderer. The feature displays all tags with article counts, links to individual tag pages, and integrates with existing navigation. Template already exists (`tag-list.html`); implementation requires adding route handlers, rendering functions, and cache management.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on Node.js 20.x
**Primary Dependencies**: Fastify (HTTP), Handlebars (templates), @blog/core (TagIndex, models)
**Storage**: In-memory cache (dev-server), static HTML files (production)
**Testing**: Vitest (unit/integration), Playwright (E2E) - E2E tests already defined
**Target Platform**: Node.js dev server + static HTML generation for S3
**Project Type**: Monorepo with packages: core, dev-server, renderer, site
**Performance Goals**: <1s page load (SC-001), per constitution <2s on average connections
**Constraints**: WCAG 2.1 AA accessibility (NFR-001), semantic HTML per constitution
**Scale/Scope**: Single page addition, affects 4 files in dev-server, 1 template move

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Author Simplicity | ✅ PASS | No author workflow changes; tags auto-derived from articles |
| II. Reader Simplicity | ✅ PASS | Simple list UI, fast load, semantic HTML, CSS-only styling |
| III. Test Confidence | ✅ PASS | E2E tests pre-defined (all-tags.spec.ts), TDD approach |
| IV. Minimal Complexity | ✅ PASS | Template exists; minimal code additions to existing patterns |
| V. Incremental Development | ✅ PASS | Single deliverable feature; independent of other work |

**WCAG 2.1 AA (per NFR-001 and Quality Standards)**: Template already includes skip-link, ARIA landmarks, `role` attributes, and semantic structure. Requires verification via axe-core.

## Project Structure

### Documentation (this feature)

```text
specs/003-all-tags-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (minimal - internal page)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── core/src/
│   └── services/tag-index.ts      # Existing TagIndex (no changes needed)
├── dev-server/src/
│   ├── server.ts                  # Add /tags route handler
│   ├── renderer.ts                # Add renderAllTags() function
│   └── state.ts                   # Add allTagsHtml cache property
├── renderer/src/
│   └── services/render-service.ts # Add all-tags page generation
└── site/
    ├── src/templates/
    │   ├── tags.html              # Move from partials/tag-list.html
    │   └── partials/tag-list.html # Remove after move
    └── tests/e2e/
        └── all-tags.spec.ts       # Existing tests (8 cases defined)
```

**Structure Decision**: Using existing monorepo structure. Changes isolated to dev-server package (route + renderer + state) and site package (template location). Core package unchanged - TagIndex already provides required data access.

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Author Simplicity | ✅ PASS | No changes to author workflow |
| II. Reader Simplicity | ✅ PASS | Semantic HTML verified; no JS required for core functionality |
| III. Test Confidence | ✅ PASS | E2E tests cover all acceptance criteria; unit tests for renderer function |
| IV. Minimal Complexity | ✅ PASS | ~50 lines new code; reuses existing TagIndex, follows established patterns |
| V. Incremental Development | ✅ PASS | Single PR delivers complete feature; no dependencies on other work |

**Design Verification**:
- Template `tags.html` uses pure CSS styling (no inline styles)
- Data flow uses existing `TagIndex` service (no new abstractions)
- Cache strategy identical to existing pages
- No new dependencies added

## Complexity Tracking

No constitution violations. Implementation follows existing patterns:
- Route handler pattern matches `/archive` and `/tags/:tag` routes
- Renderer function pattern matches `renderArchive()` and `renderTagPage()`
- Cache pattern matches `archiveHtml` and `tagPages` caching
- Template structure matches existing page templates
