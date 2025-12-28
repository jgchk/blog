# Tasks: Webhook Renderer Connection

**Input**: Design documents from `/specs/006-webhook-renderer-connection/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Tests are included per the TDD approach specified in the constitution check (III. Test Confidence).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo**: `packages/renderer/src/`, `packages/renderer/tests/`, `packages/infra/lib/`
- Primary work in `@blog/renderer` package, extending existing handlers and services

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify existing project structure matches plan.md in packages/renderer/
- [ ] T002 [P] Add any missing type definitions to packages/renderer/src/types/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### GitHubContentFetcher (Required by US1, US2, US3)

- [ ] T003 [P] Unit test for GitHubContentFetcher.fetchFile in packages/renderer/tests/unit/adapters/github-content.test.ts
- [ ] T004 [P] Unit test for GitHubContentFetcher.listDirectory in packages/renderer/tests/unit/adapters/github-content.test.ts
- [ ] T005 [P] Unit test for GitHubContentFetcher.listPostSlugs in packages/renderer/tests/unit/adapters/github-content.test.ts
- [ ] T006 [P] Unit test for GitHubContentFetcher.fetchPostFiles in packages/renderer/tests/unit/adapters/github-content.test.ts
- [ ] T007 Implement GitHubContentFetcher adapter in packages/renderer/src/adapters/github-content.ts
- [ ] T008 Export GitHubContentFetcher from packages/renderer/src/adapters/index.ts

### SyncOrchestrator Core (Required by US1, US2, US3, US4)

- [ ] T009 [P] Define SyncRequest, SyncResult, and RenderNotification types in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T010 [P] Unit test for SyncOrchestrator constructor and dependency injection in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T011 Implement SyncOrchestrator skeleton with isSyncInProgress() and getCurrentSync() in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T011a [P] Unit test for SyncOrchestrator generates unique syncId and tracks status in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T011b Implement syncId generation (UUID) and status tracking (pending/running/completed/failed) in SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T011c Add affected files list tracking to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T012 Export SyncOrchestrator from packages/renderer/src/services/index.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Automatic Post Publishing (Priority: P1) 🎯 MVP

**Goal**: Posts are automatically rendered and published when pushed to main branch

**Independent Test**: Push a new or modified post to `posts/` directory on main branch and verify rendered content appears on the live site within 60 seconds

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US1] Unit test for SyncOrchestrator.sync() incremental mode in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T014 [P] [US1] Unit test for asset copying in SyncOrchestrator in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T015 [P] [US1] Contract test for POST /webhook/github triggers sync in packages/renderer/tests/contract/webhook.test.ts
- [ ] T016 [P] [US1] Integration test for incremental sync flow in packages/renderer/tests/integration/sync-orchestrator.test.ts
- [ ] T016a [P] [US1] Unit test for concurrent sync operations do not corrupt state in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T016b [P] [US1] Integration test simulating two concurrent pushes affecting different posts complete without corruption in packages/renderer/tests/integration/sync-orchestrator.test.ts

### Implementation for User Story 1

- [ ] T017 [US1] Implement SyncOrchestrator.sync() for incremental rendering in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T018 [US1] Add fetchAndRenderPost() helper method to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T019 [US1] Add copyPostAssets() method to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T019a [P] [US1] Unit test for copyPostAssets skips files >10MB with warning logged in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T019b [US1] Add file size check (10MB limit) to copyPostAssets() with warning log in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T019c [P] [US1] Unit test for copyPostAssets logs warning when cumulative size exceeds 25MB in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T019d [US1] Add cumulative size tracking with 25MB warning threshold to copyPostAssets() in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T020 [US1] Add tag page regeneration to sync() completion in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T021 [US1] Add CloudFront cache invalidation to sync() completion in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T022 [US1] Update webhook handler to call SyncOrchestrator.sync() in packages/renderer/src/handlers/webhook.ts
- [ ] T022a [P] [US1] Unit test for webhook signature validation in packages/renderer/tests/unit/handlers/webhook.test.ts
- [ ] T022b [US1] Implement webhook signature validation using WEBHOOK_SECRET in packages/renderer/src/handlers/webhook.ts
- [ ] T023 [US1] Add parseRepository() utility to packages/renderer/src/utils/github.ts
- [ ] T023a [US1] Export parseRepository from packages/renderer/src/utils/index.ts
- [ ] T024 [US1] Update handler exports with SyncOrchestrator dependency in packages/renderer/src/handlers/index.ts

**Checkpoint**: User Story 1 fully functional - webhook triggers incremental rendering

---

## Phase 4: User Story 2 - Full Site Render on Demand (Priority: P2)

**Goal**: Administrators can trigger a full render of all posts via admin endpoint

**Independent Test**: Call POST /admin/render and verify all posts are re-rendered

### Tests for User Story 2 ⚠️

- [ ] T025 [P] [US2] Unit test for SyncOrchestrator.sync() full mode in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T026 [P] [US2] Contract test for POST /admin/render triggers full sync in packages/renderer/tests/contract/admin-api.test.ts
- [ ] T027 [P] [US2] Contract test for POST /admin/render returns 409 when sync in progress in packages/renderer/tests/contract/admin-api.test.ts
- [ ] T028 [P] [US2] Integration test for full sync flow in packages/renderer/tests/integration/sync-orchestrator.test.ts

### Implementation for User Story 2

- [ ] T029 [US2] Implement SyncOrchestrator.sync() for full rendering mode in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T030 [US2] Add triggerFullRender() method to AdminHandler in packages/renderer/src/handlers/admin.ts
- [ ] T031 [US2] Import parseRepository from utils in admin handler packages/renderer/src/handlers/admin.ts
- [ ] T032 [US2] Wire triggerFullRender to route() method in packages/renderer/src/handlers/admin.ts
- [ ] T033 [US2] Update AdminHandler export with SyncOrchestrator dependency in packages/renderer/src/handlers/index.ts
- [ ] T034 [US2] Add GITHUB_REPOSITORY environment variable to CDK stack in packages/infra/lib/blog-stack.ts
- [ ] T035 [US2] Increase render Lambda timeout to 5 minutes in packages/infra/lib/blog-stack.ts
- [ ] T036 [US2] Add /admin/render route to API Gateway in packages/infra/lib/blog-stack.ts

**Checkpoint**: User Story 2 complete - full render on demand works

---

## Phase 5: User Story 3 - Post Deletion Handling (Priority: P3)

**Goal**: Deleted posts are removed from the public blog when deleted from repository

**Independent Test**: Delete a post directory from posts/ folder and verify it no longer appears on the public blog

### Tests for User Story 3 ⚠️

- [ ] T037 [P] [US3] Unit test for SyncOrchestrator handles deletions in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T038 [P] [US3] Unit test for S3StorageAdapter.deletePrefix() in packages/renderer/tests/unit/adapters/s3-storage.test.ts
- [ ] T039 [P] [US3] Integration test for deletion sync flow in packages/renderer/tests/integration/sync-orchestrator.test.ts

### Implementation for User Story 3

- [ ] T040 [US3] Add deletePrefix() method to S3StorageAdapter in packages/renderer/src/adapters/s3-storage.ts
- [ ] T041 [US3] Add deletePost() method to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T042 [US3] Update sync() to handle removed files from changes in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T043 [US3] Add deletion paths to CloudFront invalidation in packages/renderer/src/services/sync-orchestrator.ts

**Checkpoint**: User Story 3 complete - post deletions handled correctly

---

## Phase 6: User Story 4 - Rendering Status Visibility (Priority: P3)

**Goal**: Administrators receive notifications when rendering completes or fails

**Independent Test**: Trigger a render operation and verify notification is received via SNS

### Tests for User Story 4 ⚠️

- [ ] T044 [P] [US4] Unit test for SyncOrchestrator sends success notification in packages/renderer/tests/unit/services/sync-orchestrator.test.ts
- [ ] T045 [P] [US4] Unit test for SyncOrchestrator sends failure notification in packages/renderer/tests/unit/services/sync-orchestrator.test.ts

### Implementation for User Story 4

- [ ] T046 [US4] Add buildSuccessNotification() method to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T047 [US4] Add buildFailureNotification() method to SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T048 [US4] Update sync() to send notifications on completion in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T049 [US4] Update sync() to send notifications on failure in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T049a [US4] Add NOTIFICATION_TOPIC_ARN environment variable to render Lambda in packages/infra/lib/blog-stack.ts

**Checkpoint**: User Story 4 complete - notifications working

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T050 [P] Add error handling and logging throughout SyncOrchestrator in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T050a [P] Add structured timing logs (sync start/end with duration) for SC-007 verification in packages/renderer/src/services/sync-orchestrator.ts
- [ ] T051 [P] Add retry logic for transient GitHub API failures in packages/renderer/src/adapters/github-content.ts
- [ ] T052 Run pnpm lint and fix any issues in packages/renderer/
- [ ] T053 Run pnpm typecheck and fix any type errors in packages/renderer/
- [ ] T054 Run full test suite: pnpm --filter @blog/renderer test
- [ ] T055 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3)
  - US1 and US2 are independent of each other
  - US3 depends on incremental sync from US1
  - US4 can run in parallel with US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (can run parallel with US1)
- **User Story 3 (P3)**: Can start after US1 complete (needs incremental sync base)
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core implementation before integration
- Handler updates last
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
```bash
# All unit tests for GitHubContentFetcher in parallel:
Task: T003, T004, T005, T006

# Type definitions and sync tracking tests in parallel:
Task: T009, T010, T011a
```

**Phase 3 (US1) - Tests**:
```bash
# All US1 tests in parallel:
Task: T013, T014, T015, T016, T016a, T016b, T019a
```

**Phase 4 (US2) - Tests**:
```bash
# All US2 tests in parallel:
Task: T025, T026, T027, T028
```

**Phase 5 (US3) - Tests**:
```bash
# All US3 tests in parallel:
Task: T037, T038, T039
```

**Phase 6 (US4) - Tests**:
```bash
# All US4 tests in parallel:
Task: T044, T045
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Automatic Post Publishing)
4. **STOP and VALIDATE**: Test by pushing a post to main branch
5. Deploy if ready - webhook now triggers rendering

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test push triggers render → Deploy (MVP!)
3. Add User Story 2 → Test admin full render → Deploy
4. Add User Story 3 → Test post deletion → Deploy
5. Add User Story 4 → Test notifications → Deploy
6. Each story adds value without breaking previous stories

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 69 |
| Phase 1 (Setup) | 2 |
| Phase 2 (Foundational) | 13 |
| Phase 3 (US1) | 21 |
| Phase 4 (US2) | 12 |
| Phase 5 (US3) | 7 |
| Phase 6 (US4) | 7 |
| Phase 7 (Polish) | 7 |
| Parallelizable Tasks | 31 |

**MVP Scope**: Phases 1-3 (36 tasks) delivers automatic post publishing

**Independent Test Criteria**:
- US1: Push post to main → appears on site within 60s
- US2: Call /admin/render → all posts re-rendered
- US3: Delete post from repo → removed from site
- US4: Trigger render → SNS notification received
