# Tasks: All Tags Page

**Input**: Design documents from `/specs/003-all-tags-page/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: E2E tests already exist in `packages/site/tests/e2e/all-tags.spec.ts`. No additional test tasks generated per specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project Type**: Monorepo with packages: core, dev-server, renderer, site
- Paths use `packages/{package}/src/` structure per plan.md

---

## Phase 1: Setup (Template Preparation)

**Purpose**: Move template to correct location and prepare project structure

- [ ] T001 Move template from `packages/site/src/templates/partials/tag-list.html` to `packages/site/src/templates/tags.html`
- [ ] T002 Delete `packages/site/src/templates/partials/tag-list.html` after confirming template move

---

## Phase 2: Foundational (State Management)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `allTagsHtml: string = ''` property to DevServerState class in `packages/dev-server/src/state.ts`
- [ ] T004 Add `allTagsHtml = ''` reset in `reset()` method in `packages/dev-server/src/state.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Browse All Tags (Priority: P1) 🎯 MVP

**Goal**: Users can navigate to `/tags/` and see all tags with article counts, linking to individual tag pages.

**Independent Test**: Navigate to `http://localhost:3000/tags/` and verify page displays all tags alphabetically with counts. Each tag links to `/tags/{slug}.html`.

### Implementation for User Story 1

- [ ] T005 [US1] Implement `renderAllTags()` function in `packages/dev-server/src/renderer.ts` following `renderArchive()` pattern
- [ ] T005a [US1] Add total tag count display (e.g., "Showing 15 tags") to `packages/site/src/templates/tags.html` header section
- [ ] T006 [US1] Add `/tags` route handler in `packages/dev-server/src/server.ts` following `/archive` pattern
- [ ] T007 [US1] Add `allTagsHtml` cache invalidation in `packages/dev-server/src/watcher.ts` on article changes
- [ ] T008 [US1] Update `tags.html` template with empty state message "No tags yet. Check back after articles are published." in `packages/site/src/templates/tags.html`

**Checkpoint**: User Story 1 (Browse All Tags) fully functional and testable

---

## Phase 4: User Story 2 - Navigate to Tags Page from Site Navigation (Priority: P2)

**Goal**: Users can access the tags page from site navigation on any page.

**Independent Test**: View any page, verify navigation contains "Tags" link, click it and confirm navigation to `/tags/`.

### Implementation for User Story 2

- [ ] T009 [US2] Verify navigation partial includes Tags link in `packages/site/src/templates/partials/navigation.html` (may already exist)
- [ ] T010 [US2] Add `aria-current="page"` handling for Tags link when on `/tags/` page in `packages/site/src/templates/tags.html`

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Tags Page in Production Build (Priority: P1)

**Goal**: Production renderer generates `/tags/index.html` for deployed site.

**Independent Test**: Run production renderer, verify `{output}/tags/index.html` exists with correct content.

### Implementation for User Story 3

- [ ] T011 [US3] Add `renderAllTagsPage()` function to `packages/renderer/src/services/render-service.ts` that:
  - Compiles `tags.html` template with TagIndex data
  - Returns rendered HTML string
- [ ] T012 [US3] Integrate all-tags generation into main render pipeline in `packages/renderer/src/services/render-service.ts`:
  - Call `renderAllTagsPage()` after tag pages are generated
  - Write output to `{outputDir}/tags/index.html`
  - Log generation status consistent with other pages

**Checkpoint**: All user stories (dev-server + production) fully functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and E2E test validation

- [ ] T014 Run E2E tests: `pnpm --filter @blog/site test:e2e tests/e2e/all-tags.spec.ts`
- [ ] T015 Verify accessibility compliance per NFR-001 and SC-006:
  - Run axe-core against `/tags/` page (zero violations at AA level)
  - Confirm single `<h1>` page title with proper heading hierarchy
  - Verify all tag links are keyboard-focusable with visible focus indicators
  - Test skip-link navigates to main content
  - Confirm `<main>` landmark present and properly labeled
- [ ] T016 Verify live reload works when articles are added/modified/removed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 and US3 are both P1 priority
  - US2 (P2) can proceed after or in parallel with US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core dev-server functionality
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Navigation enhancement
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Production renderer (can parallel with US1/US2)

### Within Each User Story

- Core implementation tasks are sequential (renderer → route → watcher)
- Template updates can be done in parallel with route implementation

### Parallel Opportunities

- T001 and T002 are sequential (move then delete)
- T003 and T004 are sequential (same file)
- T005, T006, T007 affect different files but have logical dependency (renderer needed for route)
- T009 and T010 can run in parallel with US1 tasks (different files)
- T011, T012, T013 are sequential (same service file)

---

## Parallel Example: User Stories 1 & 2

```bash
# After Phase 2 is complete, these can run in parallel:

# User Story 1 (dev-server):
Task: T005 - Implement renderAllTags() in packages/dev-server/src/renderer.ts
Task: T006 - Add /tags route in packages/dev-server/src/server.ts
Task: T007 - Add cache invalidation in packages/dev-server/src/watcher.ts

# User Story 2 (navigation - different files):
Task: T009 - Verify navigation partial in packages/site/src/templates/partials/navigation.html
Task: T010 - Add aria-current handling in packages/site/src/templates/tags.html
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (template move)
2. Complete Phase 2: Foundational (state property)
3. Complete Phase 3: User Story 1 (dev-server route + renderer)
4. **STOP and VALIDATE**: Test at `http://localhost:3000/tags/`
5. Run E2E tests for basic verification

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test dev-server → MVP functional
3. Add User Story 2 → Test navigation → Enhanced discoverability
4. Add User Story 3 → Test production build → Production ready
5. Each story adds value without breaking previous stories

### Recommended Order

Given US1 and US3 are both P1 priority:

1. **Phase 1-2**: Setup and Foundational
2. **Phase 3 (US1)**: Dev-server implementation (enables testing during development)
3. **Phase 4 (US2)**: Navigation (quick enhancement)
4. **Phase 5 (US3)**: Production renderer (mirrors dev-server logic)
5. **Phase 6**: Polish and full E2E verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- E2E tests already exist - implementation should make them pass
- Template exists in partials - needs move to root templates
- Follow existing patterns: `/archive` route, `renderArchive()` function
- Cache invalidation mirrors `archiveHtml` and `indexHtml` patterns
- Production renderer integration may require examining existing code patterns
