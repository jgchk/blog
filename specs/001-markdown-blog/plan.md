# Implementation Plan: Lightweight Markdown Blog

**Branch**: `001-markdown-blog` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-markdown-blog/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

A lightweight, auto-publishing markdown blog hosted on AWS. Authors drop markdown files into a Git repository, and the system automatically pre-renders them to HTML on push. Readers navigate via tags, dates, and Obsidian-style cross-links. The architecture uses serverless AWS services (Lambda, S3, API Gateway) abstracted behind interfaces for portability, with scale-to-zero economics and WCAG 2.1 AA accessibility.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on AWS Lambda Node.js 20.x
**Primary Dependencies**: unified/remark (markdown), gray-matter (front matter), AWS SDK v3
**Storage**: AWS S3 for rendered HTML/assets; Git repository as source of truth
**Testing**: Vitest (unit/integration), Playwright (E2E), aws-sdk-client-mock (Lambda testing)
**Target Platform**: AWS Lambda (backend), CloudFront + S3 (frontend/CDN), any modern browser (readers)
**Project Type**: Web application (backend rendering service + static frontend)
**Performance Goals**: Page load <2 seconds (TTFCP), scale-to-zero when idle, handle traffic bursts
**Constraints**: Minimize AWS costs (free tier where possible), cloud-agnostic core logic, WCAG 2.1 AA
**Scale/Scope**: 100-1,000 daily visitors initially, single author, ~50-500 articles
**Build Tooling**: esbuild for Lambda bundling, pnpm workspaces for monorepo
**IaC**: AWS CDK (TypeScript-native, higher-level constructs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Author Simplicity
- [x] No manual build steps required to publish (Git push triggers automatic render)
- [x] No configuration files to edit per article (front matter only)
- [x] No CLI commands to run after writing (automated pipeline)
- [x] No deployment step required for content changes (content changes auto-deploy)
- [x] Front matter is the ONLY metadata mechanism
- [x] New articles visible immediately after Git push
- [x] Invalid files skipped with warnings (FR-011)
- [x] Drafts excluded automatically (FR-008)

### II. Reader Simplicity
- [x] Pages load fast with minimal JavaScript (pre-rendered HTML from cache)
- [x] Navigation by date, tag is intuitive (FR-004, FR-006)
- [x] No registration, popups, or interruptions (static blog)
- [x] Mobile and desktop equally functional (responsive design)
- [x] Cross-links work seamlessly (FR-005)
- [x] HTML minimal and semantic—structure only
- [x] All visual styling in CSS—no inline styles
- [x] Stylesheet swap changes site look completely

### III. Test Confidence
- [x] Unit tests cover all business logic (Vitest for unit/integration)
- [x] Integration tests verify component interactions (aws-sdk-client-mock for Lambda)
- [x] E2E tests validate critical user journeys (Playwright)
- [x] Tests written before implementation (TDD mandate)
- [x] Passing test suite = feature works

### IV. Minimal Complexity
- [x] YAGNI: No features for later (shipping MVP first)
- [x] Prefer standard library over dependencies (gray-matter vs custom, esbuild vs webpack)
- [x] No premature abstraction
- [x] Sensible defaults, optional customization
- [x] Complexity justified in docs (see research.md)

### V. Incremental Development
- [x] Each increment deployable and functional (P1→P2→P3 priority order)
- [x] Ship and iterate approach
- [x] No grand architectural rewrites
- [x] Features broken into deliverable slices
- [x] Each PR represents complete working improvement

**Initial Gate Status**: PASS (all items resolved in research.md)

### Post-Design Re-evaluation (Phase 1 Complete)

All constitution principles remain satisfied after Phase 1 design:

| Principle | Design Artifact | Validation |
|-----------|-----------------|------------|
| I. Author Simplicity | quickstart.md, data-model.md | Front matter only, Git push deploys |
| II. Reader Simplicity | data-model.md (semantic HTML), contracts/api.yaml | Static pages, no JS required for content |
| III. Test Confidence | research.md (Vitest + Playwright) | Testing pyramid defined |
| IV. Minimal Complexity | research.md (esbuild, gray-matter) | Dependencies justified with alternatives |
| V. Incremental Development | Project structure (package separation) | P1→P2→P3 delivery order |

**Post-Design Gate Status**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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
├── core/                    # Cloud-agnostic business logic
│   ├── src/
│   │   ├── models/          # Article, Tag, FrontMatter types
│   │   ├── services/        # MarkdownParser, CrossLinkResolver, TagIndex
│   │   └── interfaces/      # Storage, Notification abstractions
│   └── tests/
│       └── unit/
│
├── renderer/                # Markdown → HTML rendering Lambda
│   ├── src/
│   │   ├── handlers/        # Lambda entry points
│   │   └── adapters/        # AWS S3, Git implementations
│   └── tests/
│       ├── unit/
│       └── integration/
│
├── site/                    # Static frontend (HTML/CSS templates)
│   ├── src/
│   │   ├── templates/       # Page templates (article, tag, home, archive)
│   │   └── styles/          # CSS (themeable, no inline styles)
│   └── tests/
│       └── e2e/
│
└── infra/                   # IaC (CDK/SAM)
    └── lib/                 # Stack definitions

posts/                       # Content directory (author's markdown)
├── my-first-post/
│   ├── index.md
│   └── image.png
└── another-post/
    └── index.md
```

**Structure Decision**: Monorepo with package separation. `core` contains portable business logic with no AWS dependencies. `renderer` is the Lambda service that imports core. `site` is the static frontend. `infra` contains deployment definitions. This enables testing core logic in isolation and swapping cloud providers by replacing adapters.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 4 packages in monorepo | Separation of concerns (core, renderer, site, infra) | Single package would mix cloud-agnostic and AWS-specific code, violating portability requirement |
| remark plugin ecosystem | Extensibility for wikilinks (FR-005) | marked is simpler but lacks plugin support for custom `[[link]]` syntax |
| AWS CDK over SAM | Complex multi-service architecture (Lambda, S3, CloudFront, SNS, API Gateway) | SAM is simpler but insufficient for CloudFront + SNS orchestration |

**Note**: All violations are justified by spec requirements. No gratuitous complexity introduced.
