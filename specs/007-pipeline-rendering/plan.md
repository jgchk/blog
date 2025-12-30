# Implementation Plan: Pipeline-Based Rendering (Architecture Simplification)

**Branch**: `007-pipeline-rendering` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-pipeline-rendering/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Simplify the blog architecture by removing GitHub webhook infrastructure and rendering the entire site during CI/CD pipeline execution on main branch merges. This replaces incremental rendering with full-site rendering at deploy time, leveraging existing `@blog/core` and `@blog/renderer` logic adapted to run as a build step in GitHub Actions.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on Node.js 20.x
**Primary Dependencies**: @blog/core (rendering), @blog/renderer (adapters), AWS SDK v3 (S3, CloudFront), unified/remark (markdown), gray-matter (front matter)
**Storage**: S3 bucket (`blog-content-{environment}-{account}`) for rendered HTML and assets, CloudFront distribution for CDN
**Testing**: Vitest (unit), Playwright (E2E), existing CI test suite
**Target Platform**: GitHub Actions runner (ubuntu-latest), AWS S3/CloudFront
**Project Type**: Monorepo with packages (core, dev-server, renderer, infra, site)
**Performance Goals**: Render 500 posts in <10 minutes, full deployment <20 minutes
**Constraints**: GitHub Actions 6-hour max job timeout (target 15 minutes), S3 asset limits (10MB/file, 25MB/post cumulative)
**Scale/Scope**: Up to 500 blog posts, full site rendering on every deploy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Author Simplicity ✅ PASS

| Rule | Status | Notes |
|------|--------|-------|
| No manual build steps required to publish | ✅ | Merge to main triggers automatic render and deploy |
| No configuration files to edit per article | ✅ | Posts use existing `posts/{slug}/index.md` convention |
| No CLI commands to run after writing | ✅ | Pipeline handles everything automatically |
| No deployment step required for content changes | ✅ | CI/CD pipeline deploys automatically on merge |
| Front matter is the ONLY metadata mechanism | ✅ | No change to content format |
| New articles visible immediately | ⚠️ | Within ~20 minutes (pipeline duration), not seconds |
| Invalid files skipped with warnings | ⚠️ | Spec requires fail-fast on render errors (FR-007) |
| Drafts excluded automatically | ✅ | Core rendering logic already handles `draft: true` |

**Potential violation**: FR-007 specifies fail-fast on render errors, which conflicts with "invalid files are skipped with warnings, never blocking valid content." This requires justification: deployment consistency (SC-002) is prioritized over partial publishes—a broken post should block deploy to prevent inconsistent site state.

### II. Reader Simplicity ✅ PASS

| Rule | Status | Notes |
|------|--------|-------|
| Pages load fast with minimal JavaScript | ✅ | No change to rendered output |
| Navigation by date and tag is intuitive | ✅ | All tag pages regenerated on deploy (FR-003, FR-004) |
| No registration/popups required | ✅ | No change |
| Mobile and desktop functional | ✅ | No change |
| Cross-links work seamlessly | ✅ | Full render ensures link consistency |

### III. Test Confidence ✅ PASS

| Rule | Status | Notes |
|------|--------|-------|
| Unit tests cover business logic | ✅ | Existing @blog/core tests remain |
| Integration tests verify interactions | ✅ | Pipeline rendering uses existing adapters |
| E2E tests validate user journeys | ✅ | Smoke tests run post-deploy |
| Tests written before implementation (TDD) | ✅ | Will follow TDD for new pipeline code |
| Passing suite means feature works | ✅ | E2E + smoke tests verify end-to-end |

### IV. Minimal Complexity ✅ PASS (IMPROVES)

| Rule | Status | Notes |
|------|--------|-------|
| YAGNI | ✅ | Removes unused incremental rendering complexity |
| Prefer standard library | ✅ | Uses existing dependencies |
| No premature abstraction | ✅ | Reuses existing services |
| Sensible defaults | ✅ | No configuration required |

**Positive impact**: This feature significantly simplifies the architecture by removing:
- GitHub webhook infrastructure
- Webhook Lambda handler
- Webhook secret management
- Incremental rendering logic
- Async SNS notification patterns

### V. Incremental Development ✅ PASS

| Rule | Status | Notes |
|------|--------|-------|
| Every increment deployable | ✅ | Pipeline rendering can replace webhook approach in one PR |
| "Good enough now" beats "perfect later" | ✅ | Full render is simpler than incremental optimization |
| No grand rewrites | ✅ | Reuses existing rendering logic, modifies pipeline |
| Features broken into deliverable slices | ✅ | See tasks breakdown |
| Each PR a complete improvement | ✅ | Feature is self-contained |

### Gate Status: ✅ PASSED

One justified violation documented below in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-pipeline-rendering/
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
├── core/                    # @blog/core - Rendering engine (EXISTING, no changes)
│   ├── src/
│   │   ├── models/          # Article, TagIndex models
│   │   ├── services/        # FrontMatterParser, MarkdownParser, etc.
│   │   └── index.ts         # Public exports
│   └── tests/
│
├── renderer/                # @blog/renderer - Rendering adapters (MODIFIED)
│   ├── src/
│   │   ├── adapters/        # S3StorageAdapter, GitHubContentFetcher
│   │   ├── services/        # RenderService, SyncOrchestrator (MODIFIED)
│   │   │   └── pipeline-renderer.ts   # NEW: Pipeline rendering orchestration
│   │   └── handlers/        # Lambda handlers (TO BE REMOVED/DEPRECATED)
│   └── tests/
│
├── infra/                   # @blog/infra - CDK infrastructure (MODIFIED)
│   └── lib/
│       └── blog-stack.ts    # Remove webhook Lambda, simplify stack
│
├── dev-server/              # @blog/dev-server (NO CHANGES)
└── site/                    # @blog/site - E2E tests (NO CHANGES)

.github/
└── workflows/
    └── ci-cd.yml            # MODIFIED: Add render step, remove webhook config

posts/                       # Blog content (NO CHANGES)
└── {slug}/
    └── index.md
```

**Structure Decision**: Monorepo structure with pnpm workspaces. This feature primarily modifies:
1. `.github/workflows/ci-cd.yml` - Add render and upload steps
2. `packages/renderer/` - Add pipeline-specific rendering service
3. `packages/infra/` - Remove webhook infrastructure from CDK stack

### Source Code Changes Summary

| Package | Change Type | Description |
|---------|-------------|-------------|
| `@blog/core` | None | Existing rendering logic unchanged |
| `@blog/renderer` | Modify | Add PipelineRenderer service for CI execution |
| `@blog/infra` | Modify | Remove Lambda functions, API Gateway, SNS |
| `@blog/dev-server` | None | Local development unchanged |
| `@blog/site` | None | E2E tests unchanged |
| `.github/workflows/` | Modify | Add render/upload steps, remove webhook config |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Fail-fast on render errors (vs. skip invalid) | Site consistency (SC-002) requires all-or-nothing deploys | Partial deploys could leave broken links, missing tag entries, inconsistent navigation. Full consistency is more important than partial availability. |

## Post-Design Constitution Re-Check

*Completed after Phase 1 design artifacts generated.*

### Design Decisions vs. Constitution

| Decision | Constitution Principle | Status |
|----------|----------------------|--------|
| Sequential rendering (not parallel) | IV. Minimal Complexity | ✅ Simpler, sufficient for 500 posts |
| Direct sync (no staging prefix) | IV. Minimal Complexity | ✅ Simpler than blue-green |
| Wildcard CloudFront invalidation | IV. Minimal Complexity | ✅ Simpler than tracking changed files |
| Reuse existing RenderService | IV. Minimal Complexity | ✅ No new abstractions |
| Remove Lambda/webhook infrastructure | IV. Minimal Complexity | ✅ **Major simplification** |
| Pre-compiled TypeScript | IV. Minimal Complexity | ✅ Uses existing build |
| OIDC credentials (existing) | IV. Minimal Complexity | ✅ No new secrets |

### New Risks Identified

None. The design simplifies the architecture while meeting all functional requirements.

### Final Gate Status: ✅ PASSED

Design artifacts are consistent with constitution principles. The one justified violation (fail-fast vs. skip-invalid) remains documented in Complexity Tracking above.
