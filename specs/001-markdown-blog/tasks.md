# Tasks: Lightweight Markdown Blog

**Input**: Design documents from `/specs/001-markdown-blog/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.yaml ✓

**Tests**: TDD is mandated by the constitution (III. Test Confidence). All test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md monorepo structure:
- `packages/core/` - Cloud-agnostic business logic
- `packages/renderer/` - Lambda rendering service
- `packages/site/` - Static frontend templates
- `packages/infra/` - AWS CDK infrastructure
- `posts/` - Content directory

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization with pnpm monorepo and TypeScript configuration

- [ ] T001 Initialize pnpm workspace with pnpm-workspace.yaml at repository root
- [ ] T002 Create root package.json with workspace scripts (build, test, lint, typecheck)
- [ ] T003 [P] Create root tsconfig.json with ES2022 target and strict mode per research.md
- [ ] T004 [P] Configure ESLint and Prettier at repository root
- [ ] T005 [P] Create packages/core/package.json with @blog/core name
- [ ] T006 [P] Create packages/renderer/package.json with @blog/renderer name
- [ ] T007 [P] Create packages/site/package.json with @blog/site name
- [ ] T008 [P] Create packages/infra/package.json with @blog/infra name
- [ ] T009 Install dependencies: unified, remark-parse, remark-frontmatter, remark-gfm, remark-rehype, rehype-highlight, rehype-stringify, gray-matter, unist-util-visit
- [ ] T010 Install dev dependencies: typescript, esbuild, vitest, @playwright/test, aws-sdk-client-mock, aws-cdk-lib
- [ ] T011 Create .env.example with AWS configuration template
- [ ] T012 Create posts/example-post/index.md with sample front matter for development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Core Type System

- [ ] T013 [P] Create packages/core/src/models/front-matter.ts with FrontMatter interface per data-model.md
- [ ] T014 [P] Create packages/core/src/models/article.ts with Article interface per data-model.md
- [ ] T015 [P] Create packages/core/src/models/tag.ts with Tag interface per data-model.md
- [ ] T016 [P] Create packages/core/src/models/cross-link.ts with CrossLink interface per data-model.md
- [ ] T017 [P] Create packages/core/src/models/validation-error.ts with ValidationError union type per data-model.md
- [ ] T018 Create packages/core/src/models/index.ts exporting all model types

### Abstraction Interfaces

- [ ] T019 [P] Create packages/core/src/interfaces/storage.ts with StorageAdapter interface per research.md
- [ ] T020 [P] Create packages/core/src/interfaces/notification.ts with NotificationAdapter interface per research.md
- [ ] T021 Create packages/core/src/interfaces/index.ts exporting all interfaces

### Utility Functions

- [ ] T022 Create packages/core/src/utils/slug.ts with normalizeSlug and normalizeForMatching functions (lowercase, spaces/dashes/underscores → hyphens)

### Test Infrastructure

- [ ] T023 Create packages/core/vitest.config.ts with test configuration
- [ ] T024 Create packages/renderer/vitest.config.ts with test configuration
- [ ] T025 Create packages/site/playwright.config.ts with E2E test configuration
- [ ] T026 Create root vitest.workspace.ts to run all package tests

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Write and Publish an Article (Priority: P1) MVP

**Goal**: Authors can create markdown files with front matter and have them automatically appear on the blog

**Independent Test**: Create a post folder with index.md containing front matter (title, date, tags), verify it renders to HTML with correct formatting

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US1] Unit test for FrontMatter parsing in packages/core/tests/unit/services/front-matter-parser.test.ts
- [ ] T028 [P] [US1] Unit test for Article validation in packages/core/tests/unit/services/article-validator.test.ts
- [ ] T029 [P] [US1] Unit test for MarkdownParser in packages/core/tests/unit/services/markdown-parser.test.ts
- [ ] T030 [P] [US1] Unit test for slug normalization in packages/core/tests/unit/utils/slug.test.ts
- [ ] T031 [P] [US1] Integration test for render pipeline in packages/renderer/tests/integration/render-pipeline.test.ts
- [ ] T032 [P] [US1] Contract test for webhook endpoint in packages/renderer/tests/contract/webhook.test.ts

### Implementation for User Story 1

- [ ] T033 [US1] Implement FrontMatterParser in packages/core/src/services/front-matter-parser.ts using gray-matter
- [ ] T034 [US1] Implement ArticleValidator in packages/core/src/services/article-validator.ts with validation rules from data-model.md
- [ ] T035 [US1] Implement MarkdownParser in packages/core/src/services/markdown-parser.ts with remark pipeline per research.md
- [ ] T036 [US1] Create packages/core/src/services/index.ts exporting all services
- [ ] T037 [US1] Implement S3StorageAdapter in packages/renderer/src/adapters/s3-storage.ts implementing StorageAdapter
- [ ] T038 [US1] Implement GitHubWebhookHandler in packages/renderer/src/handlers/webhook.ts handling push events
- [ ] T039 [US1] Implement RenderService in packages/renderer/src/services/render-service.ts orchestrating parse → render → store
- [ ] T040 [US1] Create packages/renderer/src/handlers/index.ts as Lambda entry point
- [ ] T041 [US1] Create esbuild configuration in packages/renderer/build.ts per research.md
- [ ] T042 [US1] Create article page template in packages/site/src/templates/article.html with semantic HTML (WCAG 2.1 AA)
- [ ] T043 [US1] Create homepage template in packages/site/src/templates/index.html showing recent articles
- [ ] T044 [US1] Create base stylesheet in packages/site/src/styles/main.css (themeable, no inline styles)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Browse Articles by Tag (Priority: P2)

**Goal**: Readers can click on a tag attached to any article and see all articles with that tag

**Independent Test**: Create 3+ articles with overlapping tags, click a tag, verify the filtered list shows only articles with that tag

### Tests for User Story 2

- [ ] T045 [P] [US2] Unit test for TagIndex in packages/core/tests/unit/services/tag-index.test.ts
- [ ] T046 [P] [US2] Unit test for Tag normalization in packages/core/tests/unit/models/tag.test.ts
- [ ] T047 [P] [US2] E2E test for tag navigation in packages/site/tests/e2e/tag-navigation.spec.ts

### Implementation for User Story 2

- [ ] T048 [US2] Implement TagIndex service in packages/core/src/services/tag-index.ts building tag → articles mapping
- [ ] T049 [US2] Extend RenderService in packages/renderer/src/services/render-service.ts to generate tag index on render
- [ ] T050 [US2] Create tag page template in packages/site/src/templates/tag.html showing tag name, count, and article list
- [ ] T051 [US2] Create tag cloud/list template in packages/site/src/templates/partials/tag-list.html for all tags view (FR-010)
- [ ] T052 [US2] Update article template in packages/site/src/templates/article.html to show tags as clickable links
- [ ] T053 [US2] Store tags.json metadata in packages/renderer/src/services/render-service.ts for tag cloud

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Navigate via Cross-Links (Priority: P3)

**Goal**: Obsidian-style [[wikilinks]] between articles work automatically

**Independent Test**: Create two articles where one references the other using [[Title]] syntax, verify the link navigates correctly

### Tests for User Story 3

- [ ] T054 [P] [US3] Unit test for remarkWikilinks plugin in packages/core/tests/unit/plugins/wikilinks.test.ts
- [ ] T055 [P] [US3] Unit test for CrossLinkResolver in packages/core/tests/unit/services/cross-link-resolver.test.ts
- [ ] T056 [P] [US3] E2E test for cross-link navigation in packages/site/tests/e2e/cross-links.spec.ts

### Implementation for User Story 3

- [ ] T057 [US3] Implement ArticleIndex in packages/core/src/services/article-index.ts with bySlug, byTitle, byAlias lookups
- [ ] T058 [US3] Implement remarkWikilinks plugin in packages/core/src/plugins/wikilinks.ts per research.md
- [ ] T059 [US3] Implement CrossLinkResolver in packages/core/src/services/cross-link-resolver.ts with resolution order: slug → title → aliases
- [ ] T060 [US3] Integrate wikilinks plugin into MarkdownParser pipeline in packages/core/src/services/markdown-parser.ts
- [ ] T061 [US3] Handle broken links in packages/core/src/plugins/wikilinks.ts (display as plain text or marked as broken per FR-005)

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Browse Articles by Date (Priority: P3)

**Goal**: Articles are organized chronologically with archive navigation

**Independent Test**: Create articles with different dates, verify they appear in chronological order on homepage and archives

### Tests for User Story 4

- [ ] T062 [P] [US4] Unit test for date sorting in packages/core/tests/unit/services/article-sorter.test.ts
- [ ] T063 [P] [US4] Unit test for archive grouping in packages/core/tests/unit/services/archive-builder.test.ts
- [ ] T064 [P] [US4] E2E test for archive navigation in packages/site/tests/e2e/archive-navigation.spec.ts

### Implementation for User Story 4

- [ ] T065 [US4] Implement ArticleSorter in packages/core/src/services/article-sorter.ts (reverse chronological)
- [ ] T066 [US4] Implement ArchiveBuilder in packages/core/src/services/archive-builder.ts grouping by year-month
- [ ] T067 [US4] Create archive page template in packages/site/src/templates/archive.html with month/year navigation
- [ ] T068 [US4] Update homepage template in packages/site/src/templates/index.html to use sorted articles
- [ ] T069 [US4] Add date formatting utility in packages/core/src/utils/date-format.ts for human-readable dates

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Admin Dashboard & Alerting (Edge Cases)

**Goal**: Handle sync failures, admin visibility, and alerting per FR-013, FR-014

### Tests for Admin Features

- [ ] T070 [P] Unit test for SyncStatus tracking in packages/renderer/tests/unit/services/sync-tracker.test.ts
- [ ] T071 [P] Unit test for SNS alerting in packages/renderer/tests/unit/adapters/sns-notifier.test.ts
- [ ] T072 [P] Contract test for admin endpoints in packages/renderer/tests/contract/admin-api.test.ts

### Implementation for Admin Features

- [ ] T073 Create packages/core/src/models/sync-status.ts with SyncStatus and SyncError interfaces per data-model.md
- [ ] T074 Implement SyncTracker in packages/renderer/src/services/sync-tracker.ts tracking sync operations
- [ ] T075 Implement SNSNotificationAdapter in packages/renderer/src/adapters/sns-notifier.ts implementing NotificationAdapter
- [ ] T076 Implement AdminHandler in packages/renderer/src/handlers/admin.ts with status, retry, articles, health endpoints per api.yaml
- [ ] T077 Add retry logic in packages/renderer/src/services/render-service.ts for failed syncs (FR-013)
- [ ] T078 Add consecutive failure detection in packages/renderer/src/services/sync-tracker.ts triggering SNS alert at 3+ failures (FR-014)

---

## Phase 8: Infrastructure (AWS CDK)

**Goal**: Deploy all AWS resources

### Tests for Infrastructure

- [ ] T079 [P] CDK snapshot tests in packages/infra/tests/snapshot.test.ts
- [ ] T080 [P] CDK assertion tests in packages/infra/tests/assertions.test.ts

### Implementation for Infrastructure

- [ ] T081 Create packages/infra/lib/blog-stack.ts with S3 bucket for rendered content
- [ ] T082 [P] Add Lambda function constructs in packages/infra/lib/blog-stack.ts for render and admin handlers
- [ ] T083 [P] Add API Gateway construct in packages/infra/lib/blog-stack.ts for webhook and admin endpoints
- [ ] T084 [P] Add CloudFront distribution in packages/infra/lib/blog-stack.ts with S3 origin
- [ ] T085 [P] Add SNS topic in packages/infra/lib/blog-stack.ts for failure alerts
- [ ] T086 Add IAM roles and policies in packages/infra/lib/blog-stack.ts per api.yaml security
- [ ] T087 Create packages/infra/bin/app.ts as CDK entry point
- [ ] T088 Add CloudWatch log groups in packages/infra/lib/blog-stack.ts for Lambda functions
- [ ] T089 Configure CloudFront cache invalidation in packages/infra/lib/blog-stack.ts

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T090 [P] Add draft filtering in packages/core/src/services/article-validator.ts (FR-008: exclude draft: true)
- [ ] T091 [P] Add invalid file handling in packages/core/src/services/article-validator.ts (FR-011: skip with warnings)
- [ ] T092 [P] Add excerpt generation in packages/core/src/services/markdown-parser.ts (first 160 chars or custom)
- [ ] T093 [P] Add image/asset copying in packages/renderer/src/services/render-service.ts (FR-012: resolve relative paths)
- [ ] T094 Accessibility audit with Playwright axe in packages/site/tests/e2e/accessibility.spec.ts (WCAG 2.1 AA)
- [ ] T095 Performance test in packages/site/tests/e2e/performance.spec.ts (page load <2s)
- [ ] T096 Update packages/site/src/styles/main.css with responsive design for mobile
- [ ] T097 Run full E2E test suite validating all user journeys
- [ ] T098 Validate against quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Admin (Phase 7)**: Can run in parallel with user stories after Foundational
- **Infrastructure (Phase 8)**: Can run in parallel after Phase 1, but should wait for handlers to exist
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories. DELIVERS MVP.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses ArticleIndex from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses ArticleIndex, independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent, no cross-story dependencies

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD mandate)
- Models before services
- Services before handlers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Setup (Phase 1)**:
- T003, T004, T005, T006, T007, T008 can all run in parallel

**Foundational (Phase 2)**:
- T013, T014, T015, T016, T017 can all run in parallel
- T019, T020 can run in parallel
- T023, T024, T025 can run in parallel

**User Story 1 (Phase 3)**:
- T027, T028, T029, T030, T031, T032 can all run in parallel (tests)

**User Story 2 (Phase 4)**:
- T045, T046, T047 can all run in parallel (tests)

**User Story 3 (Phase 5)**:
- T054, T055, T056 can all run in parallel (tests)

**User Story 4 (Phase 6)**:
- T062, T063, T064 can all run in parallel (tests)

**Infrastructure (Phase 8)**:
- T079, T080 can run in parallel (tests)
- T082, T083, T084, T085 can run in parallel (constructs)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for FrontMatter parsing in packages/core/tests/unit/services/front-matter-parser.test.ts"
Task: "Unit test for Article validation in packages/core/tests/unit/services/article-validator.test.ts"
Task: "Unit test for MarkdownParser in packages/core/tests/unit/services/markdown-parser.test.ts"
Task: "Unit test for slug normalization in packages/core/tests/unit/utils/slug.test.ts"
Task: "Integration test for render pipeline in packages/renderer/tests/integration/render-pipeline.test.ts"
Task: "Contract test for webhook endpoint in packages/renderer/tests/contract/webhook.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - **THIS IS THE MVP**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add Admin Dashboard → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP priority)
   - Developer B: Infrastructure (Phase 8)
   - Developer C: Admin Features (Phase 7)
3. After US1 complete, remaining user stories can be parallelized
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
