# Tasks: Pipeline-Based Rendering

**Input**: Design documents from `/specs/007-pipeline-rendering/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in specification. Unit tests will be written for new pipeline code following existing patterns.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/{package}/src/`, `packages/{package}/tests/`
- **Workflows**: `.github/workflows/`

---

## Phase 1: Setup

**Purpose**: Project structure and type definitions for pipeline rendering

- [X] T001 Create PipelineContext and PipelineOutput types in packages/renderer/src/services/pipeline-types.ts
- [X] T002 Create RenderResult type extending existing models in packages/renderer/src/services/pipeline-types.ts
- [X] T003 [P] Add render:pipeline script to packages/renderer/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core pipeline infrastructure that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create PipelineRenderer class skeleton in packages/renderer/src/services/pipeline-renderer.ts
- [X] T005 Implement post discovery (read all posts from posts/ directory) in packages/renderer/src/services/pipeline-renderer.ts
- [X] T006 Implement progress logging infrastructure in packages/renderer/src/services/pipeline-renderer.ts
- [X] T007 Create local filesystem adapter for reading posts in packages/renderer/src/adapters/local-storage.ts
- [X] T008 [P] Write unit tests for PipelineRenderer post discovery in packages/renderer/tests/services/pipeline-renderer.test.ts
- [X] T009 Create pipeline CLI entry point in packages/renderer/src/pipeline.ts
- [X] T009a [P] Verify home page template exists in packages/site/src/templates/index.html (verified existing)
- [X] T009b [P] Verify tag page template exists in packages/site/src/templates/tag.html (verified existing)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Publish Posts via Merge to Main (Priority: P1)

**Goal**: Render all posts during CI/CD pipeline and upload to S3 as part of deployment

**Independent Test**: Merge a PR that adds/modifies a post, verify rendered content appears on live site after pipeline completes

### Implementation for User Story 1

- [X] T010 [US1] Implement renderAllPosts() method in packages/renderer/src/services/pipeline-renderer.ts
- [X] T011 [US1] Implement copyAllAssets() for co-located images in packages/renderer/src/services/pipeline-renderer.ts
- [X] T012 [US1] Implement local file writing (rendered/ output directory) in packages/renderer/src/services/pipeline-renderer.ts
- [X] T013 [US1] Implement fail-fast error handling per FR-007 in packages/renderer/src/services/pipeline-renderer.ts
- [X] T014 [P] [US1] Write unit tests for renderAllPosts in packages/renderer/tests/services/pipeline-renderer.test.ts
- [X] T015 [US1] Add render step to deploy job in .github/workflows/ci-cd.yml
- [X] T016 [US1] Add S3 sync step (assets first, then HTML) per research.md in .github/workflows/ci-cd.yml
- [X] T017 [US1] Add CloudFront invalidation step in .github/workflows/ci-cd.yml
- [X] T017a [US1] Configure concurrency group with cancel-in-progress: true in .github/workflows/ci-cd.yml (already configured)
- [X] T017b [P] [US1] Verify job timeout is set (deploy job has timeout-minutes: 20)

**Checkpoint**: At this point, posts can be rendered and deployed via CI/CD pipeline

---

## Phase 4: User Story 2 - Full Site Render on Every Deploy (Priority: P1)

**Goal**: Regenerate all pages including tag pages and home page on every deployment

**Independent Test**: Make a template change, merge to main, verify all posts reflect the new template

### Implementation for User Story 2

- [X] T018 [US2] Implement generateTagIndex() using existing TagIndex in packages/renderer/src/services/pipeline-renderer.ts
- [X] T019 [US2] Implement renderAllTagPages() using existing RenderService in packages/renderer/src/services/pipeline-renderer.ts
- [X] T020 [US2] Implement renderAllTagsPage() for tags index in packages/renderer/src/services/pipeline-renderer.ts
- [X] T021 [US2] Implement renderHomePage() in packages/renderer/src/services/pipeline-renderer.ts
- [X] T022 [P] [US2] Write unit tests for tag page generation in packages/renderer/tests/services/pipeline-renderer.test.ts
- [X] T023 [US2] Integrate tag and home page rendering into pipeline execution in packages/renderer/src/services/pipeline-renderer.ts

**Checkpoint**: At this point, full site renders (posts + tags + home) on every deploy

---

## Phase 5: User Story 3 - Post Removal via Deletion (Priority: P2)

**Goal**: Deleted posts are removed from live blog when S3 sync runs with --delete flag

**Independent Test**: Delete a post directory in a PR, merge, verify post is no longer accessible

### Implementation for User Story 3

- [X] T024 [US3] Verify S3 sync --delete flag removes orphaned content in .github/workflows/ci-cd.yml
- [ ] T025 [P] [US3] Document deletion behavior in specs/007-pipeline-rendering/quickstart.md

**Checkpoint**: At this point, content lifecycle (add, update, delete) is fully handled

---

## Phase 6: User Story 4 - Deployment Status Visibility (Priority: P3)

**Goal**: Deployment progress and results visible in GitHub Actions logs

**Independent Test**: Trigger a deployment, review GitHub Actions run log for render step progress and completion status

### Implementation for User Story 4

- [X] T026 [US4] Enhance progress logging with post counts and timing in packages/renderer/src/services/pipeline-renderer.ts
- [X] T027 [US4] Add structured error reporting (file path, error details) in packages/renderer/src/services/pipeline-renderer.ts
- [ ] T027a [P] [US4] Add integration test verifying render failure produces error output within 60 seconds per SC-004 in packages/renderer/tests/services/pipeline-renderer.test.ts
- [X] T028 [P] [US4] Add summary output at end of pipeline (posts rendered, time elapsed) in packages/renderer/src/services/pipeline-renderer.ts

**Checkpoint**: At this point, operators have full visibility into deployment progress

---

## Phase 7: Infrastructure Cleanup

**Purpose**: Remove webhook infrastructure that is no longer needed

- [X] T029 Remove webhook Lambda function from packages/infra/lib/blog-stack.ts
- [X] T030 Remove admin Lambda function from packages/infra/lib/blog-stack.ts
- [X] T031 Remove API Gateway and all endpoints from packages/infra/lib/blog-stack.ts
- [X] T032 Remove SNS topic from packages/infra/lib/blog-stack.ts
- [X] T033 Remove githubWebhookSecret prop and related code from packages/infra/lib/blog-stack.ts
- [X] T034 [P] Remove webhook configuration step from .github/workflows/ci-cd.yml
- [X] T035 [P] Remove WEBHOOK_SECRET and WEBHOOK_PAT secrets usage from .github/workflows/ci-cd.yml
- [X] T036 Remove Lambda handlers (webhook.ts, admin.ts) from packages/renderer/src/handlers/
- [X] T037 Remove SNS notifier adapter from packages/renderer/src/adapters/sns-notifier.ts
- [X] T038 Remove sync-tracker service from packages/renderer/src/services/sync-tracker.ts
- [X] T039 Update packages/renderer/src/services/index.ts exports (added PipelineRenderer and types)
- [X] T040 Update packages/renderer/src/adapters/index.ts exports (added LocalStorageAdapter)
- [X] T041 Update packages/renderer/src/handlers/index.ts or remove if empty

**Checkpoint**: Infrastructure simplified to S3 + CloudFront only

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T042 [P] Run full local pipeline test per quickstart.md
- [ ] T043 [P] Update quickstart.md with final commands and troubleshooting
- [ ] T044 Verify E2E tests pass against rendered output
- [ ] T045 Verify smoke tests pass after deployment
- [ ] T046 [P] Create performance benchmark: generate 500 synthetic posts using a script (minimal front matter + lorem ipsum body, ~500 words each), measure render time against 10-minute target. Script location: packages/renderer/scripts/generate-benchmark-posts.ts
- [ ] T046a [P] Add CI job step that fails if render phase exceeds 10 minutes (FR-009 target); full deployment should complete in 15 minutes (SC-001 operational target)
- [ ] T047 [P] Run CDK diff to verify infrastructure changes are correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - core rendering
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (needs renderAllPosts working)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (S3 sync step must exist)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (logging enhances existing pipeline)
- **Infrastructure Cleanup (Phase 7)**: Can start after Phase 4 (full rendering works)
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

- **User Story 1 (P1)**: Core rendering - no dependencies on other stories
- **User Story 2 (P1)**: Tag pages depend on articles being rendered (builds on US1)
- **User Story 3 (P2)**: S3 --delete flag, independent of tag pages
- **User Story 4 (P3)**: Logging enhancements, can be done incrementally

### Within Each Phase

- Types before implementation
- Implementation before tests
- Tests before CI/CD integration
- Verify locally before committing CI changes

### Parallel Opportunities

- T001-T003 (Setup phase) can run in parallel
- T007-T008 can run in parallel with T004-T006
- T014, T022 (tests) can run in parallel with unrelated implementation
- T034-T035 (workflow cleanup) can run in parallel
- T036-T041 (code removal) can run in parallel after infrastructure removed

---

## Parallel Example: User Story 1

```bash
# Launch model creation together:
Task: "T010 Implement renderAllPosts() method"
Task: "T011 Implement copyAllAssets() for co-located images"
# Then sequential:
Task: "T012 Implement local file writing"
Task: "T013 Implement fail-fast error handling"
Task: "T014 Write unit tests"
Task: "T015-T017 CI/CD integration"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (types and scripts)
2. Complete Phase 2: Foundational (post discovery, CLI entry point)
3. Complete Phase 3: User Story 1 (render posts, deploy via CI)
4. **STOP and VALIDATE**: Test full render locally, verify CI pipeline
5. Complete Phase 4: User Story 2 (tag pages, home page)
6. **VALIDATE**: Full site renders correctly

### Incremental Delivery

1. Setup + Foundational → Pipeline skeleton ready
2. User Story 1 → Posts render and deploy (MVP!)
3. User Story 2 → Full site renders (complete feature)
4. User Story 3 → Deletion handled (content lifecycle complete)
5. User Story 4 → Better observability
6. Infrastructure Cleanup → Simplified architecture
7. Polish → Documentation and validation

### Key Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/renderer/src/services/pipeline-types.ts` | New | Type definitions for pipeline |
| `packages/renderer/src/services/pipeline-renderer.ts` | New | Main pipeline orchestration |
| `packages/renderer/src/adapters/local-storage.ts` | New | Local filesystem adapter |
| `packages/renderer/src/pipeline.ts` | New | CLI entry point |
| `packages/renderer/package.json` | Modify | Add render:pipeline script |
| `.github/workflows/ci-cd.yml` | Modify | Add render/upload steps, remove webhook |
| `packages/infra/lib/blog-stack.ts` | Modify | Remove Lambda/API Gateway/SNS |
| `packages/renderer/src/handlers/*.ts` | Remove | Webhook handlers no longer needed |
| `packages/renderer/src/adapters/sns-notifier.ts` | Remove | SNS no longer needed |
| `packages/renderer/src/services/sync-tracker.ts` | Remove | Sync tracking no longer needed |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- FR-007 requires fail-fast on any render error
- Research.md specifies asset-first upload ordering
- Existing RenderService and TagIndex in @blog/core are reused
