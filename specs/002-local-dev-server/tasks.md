# Tasks: Local Development Server

**Input**: Design documents from `/specs/002-local-dev-server/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD-compliant test tasks included per constitution principle III. Tests are written before/alongside implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `packages/dev-server/src/` for new package
- Uses existing packages: `packages/core/`, `packages/site/`
- Content directory: `posts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure for `@blog/dev-server`

- [ ] T001 Create package directory structure per plan.md at packages/dev-server/
- [ ] T002 Initialize package.json with name @blog/dev-server, dependencies (fastify, @fastify/static, chokidar, ws), and scripts in packages/dev-server/package.json
- [ ] T003 [P] Create tsconfig.json extending root config in packages/dev-server/tsconfig.json
- [ ] T004 [P] Create vitest.config.ts for unit/integration tests in packages/dev-server/vitest.config.ts
- [ ] T005 [P] Create index.ts with package exports in packages/dev-server/src/index.ts
- [ ] T006 Add "dev" script to root package.json pointing to @blog/dev-server start command

**Checkpoint**: Package structure ready, dependencies installable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Define DevServerConfig interface with defaults in packages/dev-server/src/types.ts
- [ ] T008 [P] Define FileChangeEvent interface in packages/dev-server/src/types.ts
- [ ] T009 [P] Define RenderedArticle interface in packages/dev-server/src/types.ts
- [ ] T010 [P] Define RenderError interface in packages/dev-server/src/types.ts
- [ ] T011 [P] Define WebSocketMessage types (ServerMessage, ClientMessage) in packages/dev-server/src/types.ts
- [ ] T012 [P] Define DevServerState interface in packages/dev-server/src/types.ts
- [ ] T013 Implement config validation (port range, directory existence) in packages/dev-server/src/config.ts
- [ ] T014 Create renderer module that imports MarkdownParser, FrontMatterParser, ArticleIndex from @blog/core in packages/dev-server/src/renderer.ts
- [ ] T015 Implement renderArticle function using @blog/core pipeline in packages/dev-server/src/renderer.ts
- [ ] T016 Implement renderIndex function for blog homepage in packages/dev-server/src/renderer.ts
- [ ] T017 [P] Implement renderArchive function for archive page in packages/dev-server/src/renderer.ts
- [ ] T018 [P] Implement renderTagPage function for tag pages in packages/dev-server/src/renderer.ts
- [ ] T019 Create DevServerState class managing articles Map, articleIndex, and client connections in packages/dev-server/src/state.ts
- [ ] T020 Implement live reload client script handling 'reload' (full page) and 'css' (stylesheet injection) messages per websocket-api.md contract in packages/dev-server/src/client.ts

### Unit Tests (Phase 2)

- [ ] T020a [P] Write unit tests for DevServerConfig validation (port range, directory existence) in packages/dev-server/tests/unit/config.test.ts
- [ ] T020b [P] Write unit tests for FileChangeEvent categorization (markdown, css, template, asset) in packages/dev-server/tests/unit/watcher.test.ts
- [ ] T020c [P] Write unit tests for slug extraction from file paths in packages/dev-server/tests/unit/watcher.test.ts
- [ ] T020d [P] Write unit tests for RenderError construction and message formatting in packages/dev-server/tests/unit/renderer.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 3 - Start Local Environment Easily (Priority: P3) 🎯 MVP Foundation

> **Implementation Note**: User story priorities (P1-P4) reflect business value, not implementation order. US3 is implemented first because it provides the HTTP server infrastructure that US1 and US2 depend on.

**Goal**: Single command startup with CLI, HTTP server, and basic page serving

**Independent Test**: Run `pnpm dev`, verify server starts within 10 seconds, navigate to localhost:3000, see blog homepage

**Note**: Despite P3 priority, this story provides the server infrastructure needed by US1 and US2, so it's implemented first as the MVP foundation.

### Implementation for User Story 3

- [ ] T021 [US3] Implement CLI argument parsing (--port, --no-open, --help) per cli-interface.md in packages/dev-server/src/cli.ts
- [ ] T022 [US3] Create Fastify server instance with @fastify/static plugin in packages/dev-server/src/server.ts
- [ ] T023 [US3] Implement GET / route serving index page per http-api.md in packages/dev-server/src/server.ts
- [ ] T024 [P] [US3] Implement GET /articles/:slug route serving article pages in packages/dev-server/src/server.ts
- [ ] T025 [P] [US3] Implement GET /archive route serving archive page in packages/dev-server/src/server.ts
- [ ] T026 [P] [US3] Implement GET /tags/:tag route serving tag pages in packages/dev-server/src/server.ts
- [ ] T027 [P] [US3] Implement GET /styles/:file route serving CSS files from packages/site/src/styles in packages/dev-server/src/server.ts
- [ ] T028 [P] [US3] Implement GET /articles/:slug/:asset route serving co-located article assets in packages/dev-server/src/server.ts
- [ ] T029 [US3] Implement GET /__dev/client.js route serving live reload script in packages/dev-server/src/server.ts
- [ ] T030 [US3] Implement HTML response middleware to inject client.js script before </body> in packages/dev-server/src/server.ts
- [ ] T031 [US3] Implement 404 and 500 error pages per http-api.md contract in packages/dev-server/src/server.ts
- [ ] T032 [US3] Implement server startup with initial article scanning and rendering in packages/dev-server/src/server.ts
- [ ] T033 [US3] Add console output for startup progress, article count, and ready URL per cli-interface.md in packages/dev-server/src/cli.ts
- [ ] T034 [US3] Implement browser auto-open on startup (respecting --no-open flag) in packages/dev-server/src/cli.ts
- [ ] T035 [US3] Implement signal handlers (SIGINT, SIGTERM) for graceful shutdown per cli-interface.md in packages/dev-server/src/cli.ts
- [ ] T036 [US3] Implement shutdown sequence: close watcher, close WebSocket clients, close HTTP server per research.md in packages/dev-server/src/cli.ts

### Tests for User Story 3

- [ ] T036a [US3] Write integration test: server starts and responds to GET / with 200 in packages/dev-server/tests/integration/server.test.ts
- [ ] T036b [US3] Write integration test: GET /articles/:slug returns 404 for nonexistent article in packages/dev-server/tests/integration/server.test.ts
- [ ] T036c [US3] Write integration test: server injects client.js script into HTML responses in packages/dev-server/tests/integration/server.test.ts
- [ ] T036d [US3] Write unit test: CLI argument parsing (--port, --no-open, --help) in packages/dev-server/tests/unit/cli.test.ts
- [ ] T036e [US3] Write integration test: graceful shutdown closes all connections in packages/dev-server/tests/integration/shutdown.test.ts

**Checkpoint**: Server starts with single command, serves static content, handles shutdown cleanly

---

## Phase 4: User Story 1 - Preview Article Changes Instantly (Priority: P1)

**Goal**: File watching for markdown files with automatic re-render and browser reload

**Independent Test**: With server running, edit posts/any-post/index.md, verify browser updates within 3 seconds

### Implementation for User Story 1

- [ ] T037 [US1] Implement chokidar file watcher for posts/**/*.md pattern in packages/dev-server/src/watcher.ts
- [ ] T038 [US1] Implement FileChangeEvent categorization (markdown, css, template, asset) per data-model.md in packages/dev-server/src/watcher.ts
- [ ] T039 [US1] Implement slug extraction from markdown file paths in packages/dev-server/src/watcher.ts
- [ ] T040 [US1] Implement debouncing for rapid file changes (100ms default) in packages/dev-server/src/watcher.ts
- [ ] T041 [US1] Create WebSocket server using ws library on same port as HTTP in packages/dev-server/src/websocket.ts
- [ ] T042 [US1] Implement client connection tracking in DevServerState in packages/dev-server/src/websocket.ts
- [ ] T043 [US1] Implement broadcast function for sending messages to all connected clients in packages/dev-server/src/websocket.ts
- [ ] T044 [US1] Handle markdown file 'change' event: re-render article, update state, broadcast reload in packages/dev-server/src/watcher.ts
- [ ] T045 [US1] Handle markdown file 'add' event: render new article, add to state and index, broadcast reload in packages/dev-server/src/watcher.ts
- [ ] T046 [US1] Handle markdown file 'unlink' event: remove from state and index, broadcast reload in packages/dev-server/src/watcher.ts
- [ ] T047 [US1] Implement RenderError handling: log to console, send error message to clients, skip broken article in packages/dev-server/src/renderer.ts
- [ ] T048 [US1] Add console output for file change events per cli-interface.md format in packages/dev-server/src/watcher.ts

### Tests for User Story 1

- [ ] T048a [US1] Write unit test: debouncing batches rapid file changes in packages/dev-server/tests/unit/watcher.test.ts
- [ ] T048b [US1] Write integration test: markdown file change triggers WebSocket 'reload' broadcast in packages/dev-server/tests/integration/live-reload.test.ts
- [ ] T048c [US1] Write integration test: new article added updates index and broadcasts reload in packages/dev-server/tests/integration/live-reload.test.ts
- [ ] T048d [US1] Write integration test: deleted article removed from index and broadcasts reload in packages/dev-server/tests/integration/live-reload.test.ts
- [ ] T048e [US1] Write unit test: RenderError logged to console without crashing server in packages/dev-server/tests/unit/renderer.test.ts

**Checkpoint**: Markdown file changes trigger automatic browser reload within 3 seconds

---

## Phase 5: User Story 2 - Preview Styling Changes Instantly (Priority: P2)

**Goal**: CSS file watching with style-only updates (no full page reload)

**Independent Test**: With server running, edit packages/site/src/styles/main.css, verify styles update without page reload

### Implementation for User Story 2

- [ ] T049 [US2] Add chokidar watch pattern for packages/site/src/styles/**/*.css in packages/dev-server/src/watcher.ts
- [ ] T050 [US2] Handle CSS file 'change' event: broadcast css message with path in packages/dev-server/src/watcher.ts
- [ ] T051 [US2] Add chokidar watch pattern for packages/site/src/templates/**/*.html in packages/dev-server/src/watcher.ts
- [ ] T052 [US2] Handle template file 'change' event: re-render all articles, broadcast reload in packages/dev-server/src/watcher.ts
- [ ] T053 [US2] Add console output for CSS and template change events in packages/dev-server/src/watcher.ts

### Tests for User Story 2

- [ ] T053a [US2] Write integration test: CSS file change broadcasts 'css' message (not 'reload') in packages/dev-server/tests/integration/live-reload.test.ts
- [ ] T053b [US2] Write integration test: template file change triggers full reload in packages/dev-server/tests/integration/live-reload.test.ts
- [ ] T053c [US2] Write integration test: CSS file change triggers browser update within 2 seconds in packages/dev-server/tests/integration/live-reload.test.ts

**Checkpoint**: CSS changes update browser styles without reload, template changes trigger full reload

---

## Phase 6: User Story 4 - Consistent Rendering with Production (Priority: P4)

**Goal**: Ensure local rendering matches production output

**Independent Test**: Render same article locally and compare structure with production Lambda output

### Implementation for User Story 4

- [ ] T054 [US4] Verify renderer uses same unified/remark plugins as @blog/core in packages/dev-server/src/renderer.ts
- [ ] T055 [US4] Ensure templates are loaded from packages/site/src/templates (same as production) in packages/dev-server/src/renderer.ts
- [ ] T056 [US4] Implement asset path rewriting for local URLs (production uses CDN paths) in packages/dev-server/src/renderer.ts
- [ ] T057 [US4] Add wikilink resolution using ArticleIndex (matching production behavior) in packages/dev-server/src/renderer.ts

### Tests for User Story 4

- [ ] T057a [US4] Write integration test: rendered article HTML structure matches @blog/core output in packages/dev-server/tests/integration/rendering.test.ts
- [ ] T057b [US4] Write unit test: asset path rewriting produces correct local URLs in packages/dev-server/tests/unit/renderer.test.ts

**Checkpoint**: Local and production rendering produce structurally identical output

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling improvements, and documentation

- [ ] T058 Handle edge case: posts directory doesn't exist (create or show helpful error) in packages/dev-server/src/config.ts
- [ ] T059 Handle edge case: port already in use (show process info and suggest alternative) in packages/dev-server/src/cli.ts
- [ ] T060 Handle edge case: malformed markdown (display error, continue serving other content) in packages/dev-server/src/renderer.ts
- [ ] T061 Handle edge case: invalid front matter (display parsing error, skip article) in packages/dev-server/src/renderer.ts
- [ ] T062 Handle edge case: simultaneous file changes (batch and process together) in packages/dev-server/src/watcher.ts
- [ ] T063 [P] Add Cache-Control: no-cache headers to all responses per http-api.md in packages/dev-server/src/server.ts
- [ ] T064 [P] Add X-Dev-Server header to responses per http-api.md in packages/dev-server/src/server.ts
- [ ] T065 Run quickstart.md validation scenarios to verify end-to-end functionality including SC-005 timing (clone to viewing <2 minutes)

### E2E Tests (Critical Paths Only)

- [ ] T066 [E2E] Write E2E test: start server → edit markdown file → verify browser receives reload within 3s in packages/dev-server/tests/e2e/content-reload.test.ts
- [ ] T067 [E2E] Write E2E test: start server → edit CSS file → verify styles update without page reload in packages/dev-server/tests/e2e/css-reload.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 3 (Phase 3)**: Depends on Foundational - provides server infrastructure
- **User Story 1 (Phase 4)**: Depends on User Story 3 (needs running server to reload)
- **User Story 2 (Phase 5)**: Depends on User Story 1 (extends watcher functionality)
- **User Story 4 (Phase 6)**: Depends on Foundational (renderer must exist)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 3 (P3)**: MVP foundation - HTTP server, CLI, basic page serving
- **User Story 1 (P1)**: Depends on US3 - adds file watching and live reload for content
- **User Story 2 (P2)**: Depends on US1 - extends file watching to CSS/templates
- **User Story 4 (P4)**: Can start after Foundational - independent verification work

### Within Each User Story

- Types/interfaces before implementation
- Config/validation before server
- Server routes before watcher integration
- Watcher before WebSocket broadcast
- Core implementation before edge case handling
- Unit tests written before or alongside implementation
- Integration tests verify completed functionality
- E2E tests run after feature story is complete

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T008, T009, T010, T011, T012 (all type definitions) can run in parallel
- T017, T018 (archive/tag rendering) can run in parallel after T016

**Phase 3 (US3)**:
- T024, T025, T026, T027, T028 (route handlers) can run in parallel after T023

**Phase 7 (Polish)**:
- T063, T064 (response headers) can run in parallel

---

## Parallel Example: Phase 2 Type Definitions

```bash
# Launch all type definitions together:
Task: "Define FileChangeEvent interface in packages/dev-server/src/types.ts"
Task: "Define RenderedArticle interface in packages/dev-server/src/types.ts"
Task: "Define RenderError interface in packages/dev-server/src/types.ts"
Task: "Define WebSocketMessage types in packages/dev-server/src/types.ts"
Task: "Define DevServerState interface in packages/dev-server/src/types.ts"
```

## Parallel Example: Phase 3 Route Handlers

```bash
# Launch route handlers together (after index route):
Task: "Implement GET /articles/:slug route in packages/dev-server/src/server.ts"
Task: "Implement GET /archive route in packages/dev-server/src/server.ts"
Task: "Implement GET /tags/:tag route in packages/dev-server/src/server.ts"
Task: "Implement GET /styles/:file route in packages/dev-server/src/server.ts"
Task: "Implement GET /articles/:slug/:asset route in packages/dev-server/src/server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 3 (server starts, serves pages)
4. **STOP and VALIDATE**: Test `pnpm dev` starts and serves content
5. Deploy/demo if ready - basic dev server works

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 3 → Test `pnpm dev` → Server starts (MVP!)
3. Add User Story 1 → Test file watching → Content auto-reloads
4. Add User Story 2 → Test CSS changes → Styles hot-reload
5. Add User Story 4 → Verify rendering parity
6. Polish → Handle edge cases → Production ready

### Single Developer Strategy

Recommended sequence for one developer:

1. Phase 1: Setup
2. Phase 2: Foundational - types first, then renderer
3. Phase 3: US3 - CLI + server ← **First testable milestone**
4. Phase 4: US1 - watcher + websocket ← **Core value delivered**
5. Phase 5: US2 - CSS hot reload
6. Phase 6: US4 - rendering verification
7. Phase 7: Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 implemented before US1/US2 because it provides server infrastructure they depend on
- Each phase should be independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths assume repository root as working directory
