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

- [X] T001 Create AWS OIDC Identity Provider (Console or CLI per quickstart.md Step 2)
- [X] T002 Create IAM role `GitHubActions-CDK-Deploy` with trust policy from contracts/aws-oidc-trust-policy.json
- [X] T003 Attach CDK deployment policy from `specs/005-ci-cd-pipeline/contracts/aws-deploy-role-policy.json` to the IAM role
- [X] T004 Bootstrap CDK in target AWS account/region if not already done (`cdk bootstrap`)
- [X] T005 [P] Configure GitHub secret `AWS_DEPLOY_ROLE_ARN` with the IAM role ARN
- [X] T006 [P] Configure GitHub secret `WEBHOOK_SECRET` for webhook validation (renamed from GITHUB_WEBHOOK_SECRET)

---

## Phase 2: Foundational (Workflow File Structure)

**Purpose**: Create the base workflow file that all user stories build upon

**⚠️ CRITICAL**: No user story implementation can begin until the base workflow file exists

- [X] T007 Create directory structure `.github/workflows/` at repository root
- [X] T008 Create base workflow file `.github/workflows/ci-cd.yml` with:
  - Workflow name: `CI/CD`
  - Trigger configuration: `on.push.branches: [main]` and `on.pull_request.branches: [main]`
  - Concurrency group: `"${{ github.workflow }} @ ${{ github.event.pull_request.head.label || github.head_ref || github.ref }}"`
  - `cancel-in-progress: true`
- [X] T008a Add timeout configuration to workflow in `.github/workflows/ci-cd.yml`:
  - `jobs.ci.timeout-minutes: 15` (FR-008: quality checks within 15 minutes)
  - `jobs.deploy.timeout-minutes: 20` (SC-003: deployment within 20 minutes)

**Checkpoint**: Base workflow file exists and triggers on PR/push events

---

## Phase 3: User Story 1 - Automated Quality Checks on Pull Requests (Priority: P1) 🎯 MVP

**Goal**: Automatically run lint and tests when PRs are created or updated to catch issues before merge

**Independent Test**: Create a PR with intentional lint errors or failing tests and verify the pipeline blocks the merge

### Implementation for User Story 1

- [X] T009 [US1] Add `ci` job to `.github/workflows/ci-cd.yml` with:
  - `name: CI`
  - `runs-on: ubuntu-latest`
  - `permissions.contents: read`
- [X] T010 [US1] Add checkout step using `actions/checkout@v4` to ci job in `.github/workflows/ci-cd.yml`
- [X] T011 [US1] Add pnpm setup step using `pnpm/action-setup@v4` to ci job in `.github/workflows/ci-cd.yml`
- [X] T012 [US1] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to ci job in `.github/workflows/ci-cd.yml`
- [X] T013 [US1] Add dependency installation step `pnpm install --frozen-lockfile` to ci job in `.github/workflows/ci-cd.yml`
- [X] T014 [US1] Add lint step `pnpm lint` to ci job in `.github/workflows/ci-cd.yml`
- [X] T015 [US1] Add typecheck step `pnpm typecheck` to ci job in `.github/workflows/ci-cd.yml`
- [X] T016 [US1] Add test step `pnpm test` to ci job in `.github/workflows/ci-cd.yml`

### E2E Testing Job (Docker Container Approach)

> **Note**: E2E tests run in a separate job using the Playwright Docker container for faster execution (no browser installation). Tests run against the dev-server started via Playwright's `webServer` config (see T016a-prereq). See research.md Section 10 for rationale.

- [X] T016a-prereq [US1] Add `webServer` configuration to `packages/site/playwright.config.ts`:
  - `command: 'pnpm --filter @blog/dev-server start'`
  - `url: 'http://localhost:3000'`
  - `reuseExistingServer: !process.env.CI`
  - `timeout: 120000` (2 minutes for server startup)
- [X] T016a-prereq2 [US1] Add `baseURL` configuration to `packages/site/playwright.config.ts`:
  - `use.baseURL: process.env.BASE_URL || 'http://localhost:3000'`
  - This allows E2E tests to run against dev-server (default) or production URL (via BASE_URL env var)
- [X] T016a [P] [US1] Add `e2e` job to `.github/workflows/ci-cd.yml` with:
  - `name: E2E Tests`
  - `runs-on: ubuntu-latest`
  - `timeout-minutes: 15`
  - `container.image: mcr.microsoft.com/playwright:v1.49.0-noble`
  - `container.options: --user 1001 --ipc=host`
  - `permissions.contents: read`
- [X] T016b [US1] Add checkout step using `actions/checkout@v4` to e2e job in `.github/workflows/ci-cd.yml`
- [X] T016c [US1] Add pnpm setup step using `pnpm/action-setup@v4` to e2e job in `.github/workflows/ci-cd.yml`
- [X] T016d [US1] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to e2e job in `.github/workflows/ci-cd.yml`
- [X] T016e [US1] Add dependency installation step `pnpm install --frozen-lockfile` to e2e job in `.github/workflows/ci-cd.yml`
- [X] T016f [US1] Add e2e test step `pnpm test:e2e` to e2e job in `.github/workflows/ci-cd.yml`
- [X] T016g [US1] Add Playwright report upload step using `actions/upload-artifact@v4` with:
  - `if: ${{ !cancelled() }}`
  - `name: playwright-report`
  - `path: playwright-report/`
  - `retention-days: 30`

**Checkpoint**: At this point, User Story 1 should be fully functional - PRs trigger CI job with lint/typecheck/test AND E2E job with Playwright tests (running in parallel)

---

## Phase 4: User Story 2 - Automated Build Verification (Priority: P1)

**Goal**: Verify the blog builds successfully before allowing deployment

**Independent Test**: Push code with build errors and verify pipeline fails with clear error messages

### Implementation for User Story 2

- [X] T017 [US2] Add build step `pnpm build` to ci job in `.github/workflows/ci-cd.yml` (after test step)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - PRs run full lint/typecheck/test/build sequence

---

## Phase 5: User Story 3 - Automated Production Deployment (Priority: P2)

**Goal**: Automatically deploy to AWS when changes merge to main branch

**Independent Test**: Merge a change to main and verify the blog updates automatically

### Implementation for User Story 3

- [X] T018 [US3] Add `deploy` job to `.github/workflows/ci-cd.yml` with:
  - `name: Deploy`
  - `needs: [ci, e2e]`
  - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
  - `runs-on: ubuntu-latest`
  - `environment: production`
  - `outputs.cloudfront_domain: ${{ steps.get-url.outputs.domain }}`
- [X] T019 [US3] Add permissions block to deploy job with `contents: read` and `id-token: write` for OIDC in `.github/workflows/ci-cd.yml`
- [X] T020 [US3] Add checkout step using `actions/checkout@v4` to deploy job in `.github/workflows/ci-cd.yml`
- [X] T021 [US3] Add pnpm setup step using `pnpm/action-setup@v4` to deploy job in `.github/workflows/ci-cd.yml`
- [X] T022 [US3] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to deploy job in `.github/workflows/ci-cd.yml`
- [X] T023 [US3] Add dependency installation step `pnpm install --frozen-lockfile` to deploy job in `.github/workflows/ci-cd.yml`
- [X] T024 [US3] Add build step `pnpm build` to deploy job in `.github/workflows/ci-cd.yml`
- [X] T025 [US3] Add AWS credentials configuration step using `aws-actions/configure-aws-credentials@v4` with:
  - `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}`
  - `aws-region: us-east-1`
- [X] T026 [US3] Add CDK deploy step with:
  - `env.GITHUB_WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}` (note: renamed from GITHUB_WEBHOOK_SECRET due to GitHub restriction)
  - `working-directory: packages/infra`
  - `run: npx cdk deploy --require-approval never -c environment=prod`
  - Add `id: cdk-deploy` to capture outputs
- [X] T026a [US3] Add step to extract CloudFront URL from CDK outputs after deploy (per `contracts/ci-cd-workflow.yml` L136-143):
  - `id: get-url`
  - Extract domain using: `aws cloudformation describe-stacks --stack-name BlogStack --query 'Stacks[0].Outputs[?OutputKey==\`DistributionDomain\`].OutputValue' --output text`
  - Output to GitHub: `echo "domain=$DOMAIN" >> $GITHUB_OUTPUT`

### Post-Deploy Smoke Tests

> **Note**: After successful deployment, run E2E tests against the live production URL to validate the real infrastructure works.

- [X] T026b [US3] Add `smoke-test` job to `.github/workflows/ci-cd.yml` with:
  - `name: Smoke Tests`
  - `needs: deploy`
  - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
  - `runs-on: ubuntu-latest`
  - `timeout-minutes: 10`
  - `container.image: mcr.microsoft.com/playwright:v1.49.0-noble`
  - `container.options: --user 1001 --ipc=host`
- [X] T026c [US3] Add checkout step using `actions/checkout@v4` to smoke-test job
- [X] T026d [US3] Add pnpm setup step using `pnpm/action-setup@v4` to smoke-test job
- [X] T026e [US3] Add Node.js setup step using `actions/setup-node@v4` with node-version 20 and cache pnpm to smoke-test job
- [X] T026f [US3] Add dependency installation step `pnpm install --frozen-lockfile` to smoke-test job
- [X] T026g [US3] Add smoke test step with:
  - `env.BASE_URL: https://${{ needs.deploy.outputs.cloudfront_domain }}`
  - `run: pnpm test:e2e`
- [X] T026h [US3] Add Playwright report upload step for smoke tests using `actions/upload-artifact@v4` with:
  - `if: ${{ !cancelled() }}`
  - `name: smoke-test-report`
  - `path: playwright-report/`
  - `retention-days: 30`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should work - merges to main trigger deployment after CI passes, then smoke tests validate production

---

## Phase 6: User Story 4 - Pipeline Status Visibility (Priority: P3)

**Goal**: Enable developers to see pipeline status and access logs for troubleshooting

**Independent Test**: Trigger a pipeline run and verify status and logs are accessible in GitHub Actions

### Implementation for User Story 4

> **Note**: This user story is largely satisfied by GitHub Actions' built-in functionality once the workflow exists. The tasks below are optional enhancements.

- [X] T027 [US4] Verify workflow job names (`CI`, `Deploy`) appear clearly in GitHub PR status checks
- [X] T028 [US4] Document expected log locations and troubleshooting steps in quickstart.md if not already present

**Checkpoint**: Pipeline runs are visible in GitHub Actions with clear status and accessible logs

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final configuration and documentation updates

- [ ] T029 Configure branch protection rule on `main` requiring `CI` and `E2E Tests` status checks to pass before merge
  - **Note**: Requires GitHub Pro for private repos, or repo must be public
- [X] T030 Run verification checklist from quickstart.md to confirm end-to-end functionality:
  - [X] PR to main triggers CI job and E2E job (in parallel)
  - [X] CI job completes lint, typecheck, test, build steps
  - [X] E2E job starts dev-server and completes Playwright tests against it
  - [X] E2E job uploads report artifact (configured, uploads on failure)
  - [ ] Failed lint/test/e2e blocks PR merge (requires branch protection - GitHub Pro)
  - [ ] Merge to main triggers Deploy job (pending: merge PR to verify)
  - [ ] Deploy job successfully runs `cdk deploy` (pending: merge PR to verify)
  - [ ] Smoke test job runs E2E tests against live production URL (pending: merge PR to verify)
  - [ ] Blog is updated and validated after successful deployment (pending: merge PR to verify)

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
  - CI job tasks (T009-T016) and E2E job tasks (T016a-T016g) can be implemented in parallel
  - T016a-prereq (webServer config) must be completed before E2E tests can run
- **User Story 2 (P1)**: Extends US1's ci job - depends on T016 completion
- **User Story 3 (P2)**: Adds deploy job with `needs: [ci, e2e]` - depends on US1 and US2 completion
  - Smoke test job (T026b-T026h) depends on deploy job completion
- **User Story 4 (P3)**: Mostly automatic - can verify at any point after workflow exists

### Within User Story 3 (Deploy Job)

Sequential order matters:
1. Checkout → Setup → Install → Build → AWS Credentials → CDK Deploy
2. AWS credentials must be configured before CDK deploy step

### Parallel Opportunities

- **Phase 1**: T005 and T006 can run in parallel (different GitHub secrets)
- **Phase 3**: T010-T013 are setup steps that could be written together, but must maintain order in YAML
- **Phase 3**: T016a is marked [P] - E2E job can be implemented in parallel with CI job tasks
- **Phase 5**: T020-T024 mirror the ci job setup and could be written quickly together
- **Runtime**: CI and E2E jobs run in parallel during workflow execution

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
- This feature primarily modifies TWO files: `.github/workflows/ci-cd.yml` and `packages/site/playwright.config.ts`
- AWS setup tasks (T001-T006) are manual/console operations, not code changes
- The contract file `contracts/ci-cd-workflow.yml` contains the complete target configuration
- Commit workflow file after each phase or logical group of changes
- Use `quickstart.md` verification checklist after each checkpoint
- E2E tests use Docker container approach (see research.md Section 10) for faster execution
- **E2E Testing Strategy (two-phase)**:
  - PR E2E tests: Run against dev-server started via Playwright's `webServer` config
  - Post-deploy smoke tests: Run against live production URL after CDK deploy
- CI and E2E jobs run in parallel; deploy depends on both passing; smoke tests depend on deploy
