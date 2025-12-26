# Tasks: CI/CD Pipeline for Blog Deployment

**Input**: Design documents from `/specs/005-ci-cd-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test scenarios are defined in quickstart.md for manual verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## User Stories Summary

| Story | Priority | Title |
|-------|----------|-------|
| US1 | P1 | Automated Quality Checks on Pull Requests |
| US2 | P1 | Automated Build Verification |
| US3 | P2 | Automated Production Deployment |
| US4 | P3 | Pipeline Status Visibility |

---

## Phase 1: Setup (AWS Infrastructure Prerequisites)

**Purpose**: One-time AWS account setup required before the workflow can function

> **Note**: These are manual setup tasks that must be completed by someone with AWS admin access. They are documented in `quickstart.md`.

- [ ] T001 Create AWS OIDC Identity Provider (Console or CLI per quickstart.md Step 2)
- [ ] T002 Create IAM role `GitHubActions-CDK-Deploy` with trust policy from contracts/aws-oidc-trust-policy.json
- [ ] T003 Attach CDK deployment policy from contracts/aws-deploy-role-policy.json to the IAM role
- [ ] T004 Bootstrap CDK in target AWS account/region if not already done (`cdk bootstrap`)
- [ ] T005 [P] Configure GitHub secret `AWS_DEPLOY_ROLE_ARN` with the IAM role ARN
- [ ] T006 [P] Configure GitHub secret `GITHUB_WEBHOOK_SECRET` for webhook validation

---

## Phase 2: Foundational (Workflow File Structure)

**Purpose**: Create the base workflow file that all user stories build upon

**⚠️ CRITICAL**: No user story implementation can begin until the base workflow file exists

- [ ] T007 Create directory structure `.github/workflows/` at repository root
- [ ] T008 Create base workflow file `.github/workflows/ci-cd.yml` with:
  - Workflow name: `CI/CD`
  - Trigger configuration: `on.push.branches: [main]` and `on.pull_request.branches: [main]`
  - Concurrency group: `"${{ github.workflow }} @ ${{ github.event.pull_request.head.label || github.head_ref || github.ref }}"`
  - `cancel-in-progress: true`

**Checkpoint**: Base workflow file exists and triggers on PR/push events

---

## Phase 3: User Story 1 - Automated Quality Checks on Pull Requests (Priority: P1) 🎯 MVP

**Goal**: Automatically run lint and tests when PRs are created or updated to catch issues before merge

**Independent Test**: Create a PR with intentional lint errors or failing tests and verify the pipeline blocks the merge

### Implementation for User Story 1

- [ ] T009 [US1] Add `ci` job to `.github/workflows/ci-cd.yml` with:
  - `name: CI`
  - `runs-on: ubuntu-latest`
  - `permissions.contents: read`
- [ ] T010 [US1] Add checkout step using `actions/checkout@v4` to ci job in `.github/workflows/ci-cd.yml`
- [ ] T011 [US1] Add pnpm setup step using `pnpm/action-setup@v4` to ci job in `.github/workflows/ci-cd.yml`
- [ ] T012 [US1] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to ci job in `.github/workflows/ci-cd.yml`
- [ ] T013 [US1] Add dependency installation step `pnpm install --frozen-lockfile` to ci job in `.github/workflows/ci-cd.yml`
- [ ] T014 [US1] Add lint step `pnpm lint` to ci job in `.github/workflows/ci-cd.yml`
- [ ] T015 [US1] Add typecheck step `pnpm typecheck` to ci job in `.github/workflows/ci-cd.yml`
- [ ] T016 [US1] Add test step `pnpm test` to ci job in `.github/workflows/ci-cd.yml`

**Checkpoint**: At this point, User Story 1 should be fully functional - PRs trigger CI job with lint/typecheck/test

---

## Phase 4: User Story 2 - Automated Build Verification (Priority: P1)

**Goal**: Verify the blog builds successfully before allowing deployment

**Independent Test**: Push code with build errors and verify pipeline fails with clear error messages

### Implementation for User Story 2

- [ ] T017 [US2] Add build step `pnpm build` to ci job in `.github/workflows/ci-cd.yml` (after test step)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - PRs run full lint/typecheck/test/build sequence

---

## Phase 5: User Story 3 - Automated Production Deployment (Priority: P2)

**Goal**: Automatically deploy to AWS when changes merge to main branch

**Independent Test**: Merge a change to main and verify the blog updates automatically

### Implementation for User Story 3

- [ ] T018 [US3] Add `deploy` job to `.github/workflows/ci-cd.yml` with:
  - `name: Deploy`
  - `needs: ci`
  - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
  - `runs-on: ubuntu-latest`
  - `environment: production`
- [ ] T019 [US3] Add permissions block to deploy job with `contents: read` and `id-token: write` for OIDC in `.github/workflows/ci-cd.yml`
- [ ] T020 [US3] Add checkout step using `actions/checkout@v4` to deploy job in `.github/workflows/ci-cd.yml`
- [ ] T021 [US3] Add pnpm setup step using `pnpm/action-setup@v4` to deploy job in `.github/workflows/ci-cd.yml`
- [ ] T022 [US3] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to deploy job in `.github/workflows/ci-cd.yml`
- [ ] T023 [US3] Add dependency installation step `pnpm install --frozen-lockfile` to deploy job in `.github/workflows/ci-cd.yml`
- [ ] T024 [US3] Add build step `pnpm build` to deploy job in `.github/workflows/ci-cd.yml`
- [ ] T025 [US3] Add AWS credentials configuration step using `aws-actions/configure-aws-credentials@v4` with:
  - `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}`
  - `aws-region: us-east-1`
- [ ] T026 [US3] Add CDK deploy step with:
  - `env.GITHUB_WEBHOOK_SECRET: ${{ secrets.GITHUB_WEBHOOK_SECRET }}`
  - `working-directory: packages/infra`
  - `run: npx cdk deploy --require-approval never -c environment=prod`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should work - merges to main trigger deployment after CI passes

---

## Phase 6: User Story 4 - Pipeline Status Visibility (Priority: P3)

**Goal**: Enable developers to see pipeline status and access logs for troubleshooting

**Independent Test**: Trigger a pipeline run and verify status and logs are accessible in GitHub Actions

### Implementation for User Story 4

> **Note**: This user story is largely satisfied by GitHub Actions' built-in functionality once the workflow exists. The tasks below are optional enhancements.

- [ ] T027 [US4] Verify workflow job names (`CI`, `Deploy`) appear clearly in GitHub PR status checks
- [ ] T028 [US4] Document expected log locations and troubleshooting steps in quickstart.md if not already present

**Checkpoint**: Pipeline runs are visible in GitHub Actions with clear status and accessible logs

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final configuration and documentation updates

- [ ] T029 Configure branch protection rule on `main` requiring `CI` status check to pass before merge
- [ ] T030 Run verification checklist from quickstart.md to confirm end-to-end functionality:
  - PR to main triggers CI job
  - CI job completes lint, typecheck, test, build steps
  - Failed lint/test blocks PR merge
  - Merge to main triggers Deploy job
  - Deploy job successfully runs `cdk deploy`
  - Blog is updated after successful deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - requires AWS admin access, must complete first
- **Foundational (Phase 2)**: Depends on Phase 1 completion (secrets configured)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (base workflow file exists)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (ci job exists)
- **User Story 3 (Phase 5)**: Depends on User Story 2 (ci job with build exists)
- **User Story 4 (Phase 6)**: Depends on Phase 2 (workflow file exists) - can run in parallel with US1-3
- **Polish (Phase 7)**: Depends on User Stories 1-3 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Extends US1's ci job - depends on T016 completion
- **User Story 3 (P2)**: Adds deploy job with `needs: ci` - depends on US2 completion (T017)
- **User Story 4 (P3)**: Mostly automatic - can verify at any point after workflow exists

### Within User Story 3 (Deploy Job)

Sequential order matters:
1. Checkout → Setup → Install → Build → AWS Credentials → CDK Deploy
2. AWS credentials must be configured before CDK deploy step

### Parallel Opportunities

- **Phase 1**: T005 and T006 can run in parallel (different GitHub secrets)
- **Phase 3**: T010-T013 are setup steps that could be written together, but must maintain order in YAML
- **Phase 5**: T020-T024 mirror the ci job setup and could be written quickly together

---

## Parallel Example: Phase 1 Setup

```bash
# These can be done simultaneously by different people or in parallel browser tabs:
Task T005: "Configure GitHub secret AWS_DEPLOY_ROLE_ARN"
Task T006: "Configure GitHub secret GITHUB_WEBHOOK_SECRET"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: AWS Setup (one-time, manual)
2. Complete Phase 2: Base workflow file
3. Complete Phase 3: User Story 1 (lint/typecheck/test on PRs)
4. Complete Phase 4: User Story 2 (add build step)
5. **STOP and VALIDATE**: Create a test PR, verify CI runs all checks
6. This provides immediate value: automated quality gates on all PRs

### Incremental Delivery

1. MVP (US1 + US2) → PRs are gated by quality checks
2. Add User Story 3 → Merges to main auto-deploy
3. Add User Story 4 → Verify visibility and troubleshooting docs
4. Add Polish → Branch protection enforces the gates

### Single Workflow File Approach

Since all tasks modify the same file (`.github/workflows/ci-cd.yml`), the recommended approach is:

1. Copy the complete workflow from `contracts/ci-cd-workflow.yml` to `.github/workflows/ci-cd.yml`
2. Verify each section matches the task requirements
3. Test incrementally (PR first, then merge to main for deploy)

This is more efficient than building the file piece by piece, as the contract already contains the validated configuration.

---

## Notes

- [P] tasks = different files/resources, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature primarily modifies ONE file: `.github/workflows/ci-cd.yml`
- AWS setup tasks (T001-T006) are manual/console operations, not code changes
- The contract file `contracts/ci-cd-workflow.yml` contains the complete target configuration
- Commit workflow file after each phase or logical group of changes
- Use `quickstart.md` verification checklist after each checkpoint
