# Implementation Plan: Local Development Server

**Branch**: `002-local-dev-server` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-local-dev-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Local development environment with file watching and WebSocket-based hot reload for iterating on blog content and styling. Reuses the existing unified/remark rendering pipeline from `@blog/core` with a local HTTP server, file watcher, and live reload capabilities.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on Node.js 20.x
**Primary Dependencies**: Existing unified/remark stack, chokidar (file watching), ws (WebSocket), express or fastify (HTTP server)
**Storage**: Local filesystem (posts/, packages/site/src/)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: macOS/Linux/Windows developer machines (Node.js 20.x)
**Project Type**: Single package addition to existing monorepo
**Performance Goals**: Content changes visible <3s, server startup <10s, CSS updates <2s
**Constraints**: Modern evergreen browsers only, single command startup, no orphan processes
**Scale/Scope**: Single developer local environment, ~50 articles typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Author Simplicity ✅
- **Alignment**: Dev server enables rapid content iteration - authors see changes instantly
- **No new friction**: No configuration files, no manual build steps during development
- **Invalid files handled**: Spec requires clear error messages without crashing (FR-007)

### II. Reader Simplicity ✅
- **Alignment**: Dev server serves same semantic HTML/CSS as production
- **Themability**: CSS changes hot-reload without full page refresh (FR-009)
- **No impact on reader experience**: Dev-only feature

### III. Test Confidence ✅
- **Alignment**: Spec defines measurable success criteria (SC-001 through SC-006)
- **TDD required**: Tests will be written before implementation
- **Clear acceptance scenarios**: 4 user stories with testable criteria

### IV. Minimal Complexity ✅
- **Reuses existing pipeline**: Leverages `@blog/core` rendering services
- **Standard tools**: chokidar, ws, express/fastify are battle-tested minimal deps
- **No over-engineering**: Single purpose - local dev iteration only
- **YAGNI compliant**: Only features in spec, no "nice to haves"

### V. Incremental Development ✅
- **Deliverable increments**: 4 prioritized user stories (P1-P4) can ship independently
- **P1 (content preview) delivers value alone**: Core story works without P2-P4
- **No big-bang**: Each story testable and deployable separately

**Gate Status: PASS** - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/002-local-dev-server/
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
├── core/                    # Existing - reuse rendering services
│   └── src/services/        # MarkdownParser, ArticleIndex, etc.
├── dev-server/              # NEW - local development server package
│   ├── src/
│   │   ├── server.ts        # HTTP server (express/fastify)
│   │   ├── watcher.ts       # File watcher (chokidar)
│   │   ├── websocket.ts     # Live reload WebSocket server
│   │   ├── renderer.ts      # Local rendering orchestrator
│   │   ├── cli.ts           # CLI entry point
│   │   └── index.ts         # Package exports
│   ├── tests/
│   │   ├── unit/            # Service unit tests
│   │   └── integration/     # Server integration tests
│   ├── package.json
│   └── vitest.config.ts
├── renderer/                # Existing - production Lambda renderer
├── site/                    # Existing - templates and CSS
│   └── src/
│       ├── templates/       # HTML templates (article, index, etc.)
│       └── styles/          # CSS files to watch
└── infra/                   # Existing - AWS CDK (not modified)

posts/                       # Content directory to watch
```

**Structure Decision**: New `packages/dev-server` package in monorepo. Follows existing package conventions. Imports from `@blog/core` for rendering, reads templates from `@blog/site`. Keeps dev tooling separate from production code.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design artifacts completed.*

### I. Author Simplicity ✅
- **Confirmed**: Single `pnpm dev` command, no configuration needed
- **Verified**: Error handling in data model shows graceful degradation for invalid files

### II. Reader Simplicity ✅
- **Confirmed**: Same templates and CSS from `@blog/site` used in dev and production
- **Verified**: CSS hot-reload preserves scroll position (no full page reload)

### III. Test Confidence ✅
- **Confirmed**: Data models define testable contracts (DevServerConfig, FileChangeEvent, etc.)
- **Verified**: Clear error types enable assertion in tests (RenderError with type field)

### IV. Minimal Complexity ✅
- **Confirmed**: Only 4 new dependencies (fastify, @fastify/static, chokidar, ws)
- **Verified**: Reuses ArticleIndex, MarkdownParser, FrontMatterParser from @blog/core
- **No violations**: Single purpose package, no abstractions beyond what's needed

### V. Incremental Development ✅
- **Confirmed**: HTTP API designed to serve P1 (content) without P2 (CSS) features
- **Verified**: WebSocket protocol supports incremental message types (reload now, css later)

**Post-Design Gate Status: PASS** - No complexity violations, design aligned with constitution.

## Complexity Tracking

> No violations to justify. Design adheres to constitution principles.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | - | - |
