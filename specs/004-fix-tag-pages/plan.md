# Implementation Plan: Fix Individual Tag Pages

**Branch**: `004-fix-tag-pages` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-fix-tag-pages/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Fix broken individual tag pages in both the development server and production build. The dev server route fails to strip the `.html` extension from tag URL parameters before matching. The production renderer is missing tag page generation entirely. Both fixes use existing templates and tag infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on Node.js 20.x
**Primary Dependencies**: Fastify 4.28.0 (dev-server HTTP), Handlebars 4.7.8 (templates), @blog/core (TagIndex, models), AWS SDK v3 (production renderer)
**Storage**: In-memory cache (dev-server), S3 static files (production)
**Testing**: Vitest 1.0.0 (unit/integration), Playwright 1.40.0 (E2E)
**Target Platform**: Local Node.js server (dev), AWS Lambda + S3 + CloudFront (production)
**Project Type**: Monorepo with packages: core, dev-server, renderer, site, infra
**Performance Goals**: Pages load in under 2 seconds (constitution requirement)
**Constraints**: No new dependencies, minimal code changes, existing template reuse
**Scale/Scope**: Bug fix affecting 2 packages (~50-100 lines of new/modified code)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Author Simplicity** | No impact - fix does not affect publishing workflow | PASS |
| **II. Reader Simplicity** | Directly improves - fixes broken tag navigation (links currently 404) | PASS |
| **III. Test Confidence** | E2E tests already exist expecting this functionality; TDD approach required | PASS |
| **IV. Minimal Complexity** | Bug fix only - no new abstractions, reuses existing templates and TagIndex | PASS |
| **V. Incremental Development** | Small, focused fix deliverable independently | PASS |

**Gate Result**: PASS - All principles aligned. This is a pure bug fix that improves reader experience without adding complexity.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-tag-pages/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── core/                           # Shared domain models & services (NO CHANGES)
│   └── src/
│       ├── models/tag.ts           # Tag model, normalizeTagSlug() - existing
│       └── services/tag-index.ts   # TagIndex service - existing
├── dev-server/                     # Local development server (FIX REQUIRED)
│   └── src/
│       ├── server.ts               # Route handling - MODIFY: strip .html extension
│       └── renderer.ts             # Tag page rendering - existing, no changes
├── renderer/                       # Production render pipeline (FIX REQUIRED)
│   └── src/
│       └── services/
│           └── render-service.ts   # ADD: renderTagPage(), publishTagPage()
├── site/                           # Static templates & styles (NO CHANGES)
│   └── src/
│       └── templates/
│           └── tag.html            # Tag page template - existing, correct
└── infra/                          # AWS CDK infrastructure (NO CHANGES)

tests/                              # Test locations
├── packages/dev-server/tests/
│   ├── unit/renderer.test.ts       # Existing unit tests
│   └── e2e/                        # E2E tests (Playwright)
├── packages/renderer/tests/
│   ├── unit/services/              # ADD: tag page render tests
│   └── integration/                # ADD: tag page publish tests
└── packages/site/tests/e2e/
    ├── all-tags.spec.ts            # Existing - validates tag links
    └── tag-navigation.spec.ts      # Existing - validates tag page navigation
```

**Structure Decision**: Monorepo structure. Changes confined to `packages/dev-server` (route fix) and `packages/renderer` (production tag page generation). All other packages remain unchanged.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. This implementation stays within constitution guidelines.

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design completion.*

| Principle | Post-Design Assessment | Status |
|-----------|------------------------|--------|
| **I. Author Simplicity** | Unchanged - fix is transparent to authors | PASS |
| **II. Reader Simplicity** | Confirmed - design restores expected navigation with no additional steps | PASS |
| **III. Test Confidence** | Confirmed - existing E2E tests validate the fix; unit tests follow existing patterns | PASS |
| **IV. Minimal Complexity** | Confirmed - ~5 lines for dev-server fix, ~50-100 lines for production using existing patterns | PASS |
| **V. Incremental Development** | Confirmed - two independent fixes can be deployed separately if needed | PASS |

**Final Gate Result**: PASS - Design phase complete. Ready for task generation.

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Plan | `specs/004-fix-tag-pages/plan.md` | This file |
| Research | `specs/004-fix-tag-pages/research.md` | Research findings and decisions |
| Data Model | `specs/004-fix-tag-pages/data-model.md` | Entity documentation (existing models) |
| HTTP Routes | `specs/004-fix-tag-pages/contracts/http-routes.md` | Route contracts |
| Internal API | `specs/004-fix-tag-pages/contracts/internal-api.md` | Method contracts |
| Quickstart | `specs/004-fix-tag-pages/quickstart.md` | Development guide |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
