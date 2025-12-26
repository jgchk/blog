# Data Model: CI/CD Pipeline

**Feature Branch**: `005-ci-cd-pipeline`
**Date**: 2025-12-26

---

## Overview

This feature is infrastructure-as-code with no database entities. The "data model" describes the workflow structure, job relationships, and configuration schema.

---

## Workflow Structure

### Pipeline Entity Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CI/CD Pipeline                              │
├─────────────────────────────────────────────────────────────────────┤
│ Triggers:                                                           │
│   - push to main                                                    │
│   - pull_request to main                                            │
├─────────────────────────────────────────────────────────────────────┤
│ Concurrency Group: workflow @ branch                                │
│ Cancel In-Progress: true                                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │     CI Job      │             │   Deploy Job    │
          │                 │             │                 │
          │ runs-on: ubuntu │             │ runs-on: ubuntu │
          │                 │             │                 │
          │ Triggers:       │             │ Triggers:       │
          │ - All PRs       │  ────────►  │ - main push     │
          │ - main push     │   needs     │   only          │
          └─────────────────┘             └─────────────────┘
                    │                               │
          ┌─────────┴─────────┐           ┌────────┴────────┐
          ▼                   ▼           ▼                 ▼
    ┌──────────┐       ┌──────────┐ ┌──────────┐     ┌──────────┐
    │ Checkout │       │  Setup   │ │   AWS    │     │   CDK    │
    │          │──────►│  pnpm    │ │  OIDC    │────►│  Deploy  │
    └──────────┘       │  Node.js │ │  Auth    │     │          │
                       │  Cache   │ └──────────┘     └──────────┘
                       └──────────┘
                             │
               ┌─────────────┼─────────────┬─────────────┐
               ▼             ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
         │  Lint    │  │ Typecheck│  │   Test   │  │  Build   │
         │          │  │          │  │          │  │          │
         │ pnpm lint│  │ pnpm     │  │ pnpm test│  │pnpm build│
         │          │  │ typecheck│  │          │  │          │
         └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Key Entities

### 1. Pipeline Trigger

| Field | Type | Description |
|-------|------|-------------|
| event | `push` \| `pull_request` | GitHub event that triggered the run |
| ref | string | Git ref (e.g., `refs/heads/main`, `refs/pull/123/merge`) |
| sha | string | Commit SHA |
| actor | string | GitHub username who triggered the event |

**State Transitions:**
- `push to main` → CI + Deploy jobs run
- `pull_request` → CI job only

### 2. Pipeline Run

| Field | Type | Description |
|-------|------|-------------|
| id | number | GitHub-assigned workflow run ID |
| status | `queued` \| `in_progress` \| `completed` | Current run status |
| conclusion | `success` \| `failure` \| `cancelled` \| null | Final result |
| started_at | timestamp | When the run started |
| completed_at | timestamp \| null | When the run finished |

**State Machine:**
```
queued → in_progress → completed (success|failure|cancelled)
           ↓
       cancelled (via concurrency)
```

### 3. Job

| Field | Type | Description |
|-------|------|-------------|
| name | `CI` \| `Deploy` | Job identifier |
| status | `queued` \| `in_progress` \| `completed` | Current job status |
| conclusion | `success` \| `failure` \| `cancelled` \| `skipped` | Final result |
| needs | Job[] | Jobs that must complete before this one starts |
| if | string | Condition for running (e.g., `github.ref == 'refs/heads/main'`) |

**CI Job Steps:**
1. Checkout
2. Setup pnpm
3. Setup Node.js (with cache)
4. Install dependencies (`pnpm install --frozen-lockfile`)
5. Lint (`pnpm lint`)
6. Typecheck (`pnpm typecheck`)
7. Test (`pnpm test`)
8. Build (`pnpm build`)

**Deploy Job Steps:**
1. Checkout
2. Setup pnpm
3. Setup Node.js (with cache)
4. Install dependencies
5. Build
6. Configure AWS credentials (OIDC)
7. CDK Deploy

### 4. GitHub Status Check

| Field | Type | Description |
|-------|------|-------------|
| context | string | Check name (job name, e.g., "CI", "Deploy") |
| state | `pending` \| `success` \| `failure` \| `error` | Check status |
| target_url | string | Link to workflow run |
| description | string | Human-readable status message |

---

## Configuration Schema

### Workflow File Schema (`ci-cd.yml`)

```yaml
name: string                    # Workflow display name
on:                             # Trigger configuration
  push:
    branches: string[]          # Branches to trigger on push
  pull_request:
    branches: string[]          # Branches to trigger on PR

concurrency:
  group: string                 # Concurrency group expression
  cancel-in-progress: boolean   # Whether to cancel previous runs

jobs:
  ci:
    name: string                # Display name
    runs-on: string             # Runner type (ubuntu-latest)
    permissions:
      contents: string          # read
    steps: Step[]               # Ordered list of steps

  deploy:
    name: string
    needs: string[]             # Job dependencies [ci]
    if: string                  # Condition expression
    runs-on: string
    permissions:
      contents: string          # read
      id-token: string          # write (for OIDC)
    environment: string         # GitHub environment (production)
    steps: Step[]
```

### Step Schema

```yaml
- name: string                  # Step display name
  uses: string                  # Action reference (e.g., actions/checkout@v4)
  with:                         # Action inputs
    key: value
  run: string                   # Shell command to execute
  env:                          # Environment variables
    KEY: value
  id: string                    # Step ID for outputs
  if: string                    # Condition expression
```

---

## Secret Configuration

| Secret | Required For | Description |
|--------|--------------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | Deploy job | IAM role ARN for OIDC authentication |
| `AWS_ACCOUNT_ID` | Deploy job | AWS account ID for CDK context |
| `GITHUB_WEBHOOK_SECRET` | Deploy job | Secret passed to CDK for webhook validation |

---

## Validation Rules

### Workflow Validation
- `concurrency.group` must include workflow and branch to prevent cross-PR cancellation
- `deploy.needs` must include `ci` to enforce gate
- `deploy.if` must restrict to main branch push events

### Step Validation
- `pnpm install` must use `--frozen-lockfile` to ensure reproducible builds
- AWS credentials step must appear before CDK deploy step
- `cdk deploy` must use `--require-approval never` for automation

### Timing Constraints (from spec)
- SC-001: Quality checks (CI job) must complete within 10 minutes
- SC-003: Full deployment (CI + Deploy) must complete within 20 minutes
- FR-008: All quality checks must complete within 15 minutes

---

## Relationships

```
Pipeline Run 1────* Job
Job 1────* Step
Job *────* Job (needs relationship)

Pipeline Run 1────1 Pipeline Trigger
Pipeline Run 1────* GitHub Status Check (one per job)
```

---

## State Transitions

### Successful PR Flow
```
PR opened → CI queued → CI in_progress → CI success
                                           ↓
                                    PR check passes
                                           ↓
                                    Ready to merge
```

### Successful Deploy Flow
```
Merge to main → CI queued → CI in_progress → CI success
                                               ↓
                                        Deploy queued
                                               ↓
                                        Deploy in_progress
                                               ↓
                                        Deploy success
                                               ↓
                                        Blog updated
```

### Failure Flow
```
Push → CI in_progress → Step failure → CI failure
                                          ↓
                                   Deploy skipped
                                          ↓
                                   PR blocked (if PR)
```

### Cancel Flow
```
Push A → CI in_progress
Push B → CI queued → cancels Push A CI → CI cancelled
                                            ↓
                                      Push B CI runs
```
