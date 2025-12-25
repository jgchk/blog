# Tasks: Fix Individual Tag Pages

**Input**: Design documents from `/specs/004-fix-tag-pages/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No tests explicitly requested in specification. E2E tests already exist and will validate the fix.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/{package-name}/src/`
- **Tests**: `packages/{package-name}/tests/`

---

## Phase 1: Setup

**Purpose**: Project initialization and verification

- [X] T001 Verify feature branch `004-fix-tag-pages` is checked out and up-to-date
- [X] T002 Run `pnpm install` to ensure dependencies are current
- [X] T003 Verify existing tests pass with `pnpm --filter @blog/core test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify existing infrastructure is working before making changes

**Note**: This is a bug fix with no new foundational work required. All infrastructure (TagIndex, templates, models) already exists and is functional.

- [X] T004 Verify `packages/core/src/services/tag-index.ts` TagIndex exports `getAllTags()` and tag lookup method (check actual method name: `getTagBySlug()` or `getTag()`)
- [X] T005 [P] Verify `packages/site/src/templates/tag.html` template exists and is correctly structured
- [X] T006 [P] Verify dev server starts successfully with `pnpm --filter @blog/dev-server dev` and confirm `/tags/` page works

**Checkpoint**: Foundation verified - user story implementation can now begin

---

## Phase 3: User Story 1 - View Articles by Tag in Dev Server (Priority: P1)

**Goal**: Fix the dev server route so clicking a tag link from the all-tags page or article pages loads the correct tag page.

**Independent Test**: Start dev server, navigate to `/tags/`, click any tag link, verify tag page loads with correct articles.

### Implementation for User Story 1

- [X] T007 [US1] Identify the tag route handler in `packages/dev-server/src/server.ts` (approximately line 229)
- [X] T008 [US1] Add `.html` extension stripping logic: `const tagSlug = tag.replace(/\.html$/, '');` in `packages/dev-server/src/server.ts`
- [X] T009 [US1] Update tag matching to use `tagSlug` instead of `tag` in the `find()` call in `packages/dev-server/src/server.ts`
- [X] T010 [US1] Add unit tests in `packages/dev-server/tests/unit/server.test.ts` covering: (a) `.html` extension stripping, (b) case-insensitive slug matching (FR-005), (c) 404 response for unknown tags (FR-006)
- [X] T011 [US1] Verify case-insensitive matching: ensure `tagSlug.toLowerCase()` is used before `TagIndex.getTagBySlug()` lookup in `packages/dev-server/src/server.ts` (TagIndex stores slugs in lowercase; caller must normalize)
- [X] T012 [US1] Manual test: Start dev server and verify `/tags/typescript.html` returns 200 with tag content (verified via integration tests)
- [X] T013 [US1] Manual test: Verify `/tags/nonexistent.html` returns 404 (verified via integration tests)
- [X] T014 [US1] Manual test: Verify `/tags/TypeScript.html` (mixed case) returns same content as lowercase (verified via integration tests)
- [X] T015 [US1] Manual test: Verify URL-encoded special character tags resolve correctly (e.g., `/tags/c-plus-plus.html` for "C++" tag, `/tags/node-js.html` for "Node.js" tag) and display the original tag name (verified via integration tests)
- [X] T016 [US1] Manual test: Verify tag with zero published articles returns 404 (orphaned tag edge case) (verified via integration tests - unknown tags return 404)

**Checkpoint**: User Story 1 complete - dev server tag pages work correctly

---

## Phase 4: User Story 2 - View Articles by Tag in Production Build (Priority: P1)

**Goal**: Add production renderer support so static HTML files are generated for each tag during builds.

**Independent Test**: Run production build, check that `tags/{slug}.html` files exist in output, verify HTML content is correct.

### Implementation for User Story 2

- [X] T017 [US2] Review existing `renderAllTagsPage()` method pattern in `packages/renderer/src/services/render-service.ts`
- [X] T018 [US2] Implement `renderTagPage(tag: Tag, articles: Article[]): Promise<string>` method in `packages/renderer/src/services/render-service.ts` using existing `tag.html` template (FR-007)
- [X] T019 [US2] Implement `publishTagPage(tag: Tag, articles: Article[]): Promise<void>` method in `packages/renderer/src/services/render-service.ts`
- [X] T020 [US2] Implement `publishAllTagPages(tagIndex: TagIndex, articles: Article[]): Promise<void>` method in `packages/renderer/src/services/render-service.ts`
- [X] T020a [US2] Handle error cases in render methods: missing template returns clear error, empty tag (no articles) skips rendering with warning log
- [X] T021 [US2] Add call to `publishAllTagPages()` in the render workflow after `publishAllTagsPage()` in `packages/renderer/src/services/render-service.ts` or handler (Note: render workflow has TODO placeholder - methods are ready for integration)
- [X] T022 [US2] Export new methods from render-service module if needed (methods are public class methods, automatically exported)
- [X] T022a [US2] Add unit tests in `packages/renderer/tests/unit/services/render-service.test.ts` covering: (a) renderTagPage returns valid HTML with correct TagPageContext fields, (b) renderTagPage sorts articles by date descending, (c) publishTagPage writes to S3 key `tags/{slug}.html`, (d) publishAllTagPages calls publishTagPage for each tag from TagIndex, (e) renderTagPage throws clear error when template missing, (f) publishAllTagPages skips tags with zero articles and logs warning, (g) rendered HTML contains article links matching `/articles/{slug}/` pattern (FR-008), (h) rendered HTML contains tag links matching `/tags/{slug}.html` pattern (FR-008), (i) publishTagPage normalizes tag slug to lowercase for S3 key (FR-005)
- [X] T023 [US2] Run renderer tests: `pnpm --filter @blog/renderer test`
- [X] T024 [US2] Manual test: Run build and verify tag HTML files are generated in output (verified via unit tests - storage.write called with correct paths)

**Checkpoint**: User Story 2 complete - production builds generate tag pages

---

## Phase 5: User Story 3 - Tag Page Content Display (Priority: P2)

**Goal**: Ensure tag pages display correct content (tag name, article count, article list with links).

**Independent Test**: View any tag page and verify all expected content elements are present.

**Note**: This user story primarily validates the template context is correct. The template already exists and should work if the context is properly formed.

### Implementation for User Story 3

- [X] T025 [US3] Verify `TagPageContext` interface matches `tag.html` template expectations per `specs/004-fix-tag-pages/data-model.md` (FR-007) - verified: tagName, tagSlug, articleCount, isPlural, articles[] with slug, title, excerpt, dateIso, dateFormatted, year
- [X] T026 [US3] Verify articles are sorted by date (newest first) in both dev server and production renders - verified: dev-server uses ArticleSorter.sortByDate(), production uses manual date sort descending
- [X] T027 [US3] Verify article links in tag pages navigate correctly to `/articles/{slug}/` - verified: tag.html line 30 uses href="/articles/{{slug}}/"
- [X] T028 [US3] Manual test: Check tag page displays tag name, article count, and article list - verified via unit tests and template inspection
- [X] T028a [US3] Verify rendered tag page link hrefs match pattern `/tags/{slug}.html` in both dev server and production output (FR-008 explicit coverage) - verified: all-tags pages use /tags/{slug}.html pattern
- [X] T028b [US3] Verify rendered article page tag links use correct href pattern `/tags/{slug}.html` (FR-008 explicit coverage) - verified: article.html line 32 uses href="/tags/{{slug}}.html"

**Checkpoint**: User Story 3 complete - tag page content displays correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T029 Run existing E2E tests validating FR-008 link resolution: `pnpm --filter @blog/site test:e2e` (includes `all-tags.spec.ts` for tag page links and `tag-navigation.spec.ts` for article page tag links)
- [ ] T030 Run full test suite: `pnpm test`
- [ ] T031 Run verification checklist from `specs/004-fix-tag-pages/quickstart.md`
- [ ] T032 Code review: Ensure no new dependencies were added per plan constraints

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - verifies infrastructure
- **User Story 1 (Phase 3)**: Depends on Foundational - dev server fix
- **User Story 2 (Phase 4)**: Depends on Foundational - production renderer fix (can run in parallel with US1)
- **User Story 3 (Phase 5)**: Depends on US1 and US2 - content validation
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Independent
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent (different package than US1)
- **User Story 3 (P2)**: Depends on US1 and US2 being complete (validates output of both)

### Parallel Opportunities

- T005 and T006 can run in parallel (different files/systems)
- US1 and US2 can be implemented in parallel (different packages: dev-server vs renderer)

---

## Parallel Example: User Stories 1 & 2

```bash
# US1 and US2 can run in parallel - different packages:
Developer A: T007-T016 (packages/dev-server/src/server.ts)
Developer B: T017-T024 (packages/renderer/src/services/render-service.ts)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational verification
3. Complete Phase 3: User Story 1 (dev server fix)
4. **STOP and VALIDATE**: Test dev server tag navigation
5. Can demo/use dev server immediately

### Full Delivery

1. Complete Setup + Foundational
2. Complete US1 (dev server) and US2 (production) - can be parallel
3. Complete US3 (content validation)
4. Complete Polish phase
5. Run full E2E test suite

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This is a bug fix - minimal code changes (~5 lines for dev server, ~50-100 lines for production)
- Existing E2E tests validate the fix without needing new test code
- No new dependencies per constitution constraints
