# Implementation Plan: Webhook Renderer Connection

**Branch**: `006-webhook-renderer-connection` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-webhook-renderer-connection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Connect the existing GitHub webhook handler to the rendering pipeline so that pushes to the main branch automatically trigger post rendering, asset copying, and tag page regeneration. This feature completes the automatic publishing workflow by implementing: incremental rendering for webhook events, full-site rendering for admin operations, post deletion handling, and render status notifications via SNS.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x
**Primary Dependencies**: AWS SDK v3 (S3, SNS, CloudFront), unified/remark (markdown), gray-matter (front matter), native fetch (GitHub API)
**Storage**: S3 bucket (blog-content-{environment}-{account}) for rendered HTML and assets
**Testing**: Vitest (unit, contract, integration), Playwright (E2E)
**Target Platform**: AWS Lambda behind API Gateway
**Project Type**: Monorepo with 5 packages (@blog/core, @blog/renderer, @blog/dev-server, @blog/infra, @blog/site)
**Performance Goals**: Posts visible within 60 seconds of push; full render of 500 posts without timeout
**Constraints**: Lambda 15-minute max execution; public GitHub repo (no auth needed to fetch)
**Scale/Scope**: Up to 500 posts; typical push affects 1-5 files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Author Simplicity
| Rule | Status | Notes |
|------|--------|-------|
| No manual build steps | PASS | Webhook triggers automatic rendering on push |
| No configuration files per article | PASS | Posts remain as markdown with front matter only |
| No CLI commands after writing | PASS | Push to main is the only action required |
| No deployment step for content changes | PASS | Automatic pipeline handles everything |
| Front matter is ONLY metadata mechanism | PASS | No changes to content structure |
| New articles visible immediately | PASS | 60-second target meets "immediately/seconds" requirement |
| Invalid files skipped with warnings | PASS | Error handling skips bad files, continues processing |
| Drafts excluded automatically | PASS | Existing draft filtering remains in place |

### II. Reader Simplicity
| Rule | Status | Notes |
|------|--------|-------|
| Pages load fast with minimal JS | PASS | No changes to frontend output |
| Navigation by date and tag intuitive | PASS | Tag pages regenerated on every sync |
| No registration/popups required | PASS | No changes to reader experience |
| Mobile/desktop equally functional | PASS | No changes to responsive design |
| Cross-links work seamlessly | PASS | No changes to link resolution |

### III. Test Confidence
| Rule | Status | Notes |
|------|--------|-------|
| Unit tests cover business logic | PASS | New services will have unit tests |
| Integration tests verify interactions | PASS | Render pipeline integration tests planned |
| E2E tests validate critical journeys | PASS | Existing E2E tests cover publish/navigate/read |
| Tests written before implementation | PASS | TDD approach per constitution |
| Passing suite means feature works | PASS | No manual QA required |

### IV. Minimal Complexity
| Rule | Status | Notes |
|------|--------|-------|
| YAGNI | PASS | Only building what spec requires |
| Prefer standard library | PASS | Using native fetch (Node.js 20 built-in) instead of octokit |
| No premature abstraction | PASS | Extending existing patterns, not creating new abstractions |
| Sensible defaults | PASS | No new configuration required |

### V. Incremental Development
| Rule | Status | Notes |
|------|--------|-------|
| Every increment deployable | PASS | Each user story is independently deliverable |
| Good enough now > perfect later | PASS | Incremental approach to features |
| No grand rewrites | PASS | Building on existing webhook/render infrastructure |
| Features broken into slices | PASS | 4 user stories with clear priorities |

**GATE RESULT**: PASS - Proceed to Phase 0

### Post-Design Re-evaluation (Phase 1 Complete)

After completing research and design, re-checking constitution alignment:

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Author Simplicity | PASS | Design confirms automatic publishing with no manual steps |
| II. Reader Simplicity | PASS | No changes to frontend; tag pages auto-regenerate |
| III. Test Confidence | PASS | Comprehensive test plan: unit, contract, integration |
| IV. Minimal Complexity | PASS | Simplified: native fetch instead of octokit; no new packages |
| V. Incremental Development | PASS | 4 deliverable user stories; existing infra extended |

**POST-DESIGN GATE**: PASS - Ready for task generation

## Project Structure

### Documentation (this feature)

```text
specs/006-webhook-renderer-connection/
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
├── core/                 # @blog/core - Domain models, parsing, utilities
│   └── src/
│       ├── models/       # Article, TagIndex, Archive types
│       ├── services/     # PostScanner, MarkdownParser, validators
│       └── index.ts
│
├── renderer/             # @blog/renderer - AWS Lambda handlers (PRIMARY WORK AREA)
│   ├── src/
│   │   ├── adapters/     # S3StorageAdapter, SnsNotifierAdapter
│   │   ├── handlers/     # webhook.ts, admin.ts (Lambda entry points)
│   │   └── services/     # RenderService, SyncTracker, RetryHandler
│   └── tests/
│       ├── contract/     # webhook.test.ts, admin-api.test.ts
│       ├── integration/  # render-pipeline.test.ts
│       └── unit/         # Adapter and service unit tests
│
├── infra/                # @blog/infra - CDK infrastructure
│   ├── lib/
│   │   └── blog-stack.ts # S3, CloudFront, Lambda, API Gateway definitions
│   └── bin/
│       └── app.ts        # CDK app entry point
│
├── dev-server/           # @blog/dev-server - Local development (no changes needed)
│
└── site/                 # @blog/site - E2E tests (may add webhook integration tests)
```

**Structure Decision**: Monorepo with pnpm workspaces. Primary work in `@blog/renderer` package, extending existing handlers and services. No new packages needed.

## Complexity Tracking

> **No violations identified. All design decisions align with constitution principles.**

N/A - No complexity justifications needed.
