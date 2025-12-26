# Research: CI/CD Pipeline for Blog Deployment

**Feature Branch**: `005-ci-cd-pipeline`
**Research Date**: 2025-12-26

---

## Research Summary

This document consolidates research findings for implementing a GitHub Actions CI/CD pipeline for the blog monorepo. All NEEDS CLARIFICATION items have been resolved through research.

---

## 1. pnpm Monorepo Caching Strategy

### Decision
Use `pnpm/action-setup@v4` with built-in caching via `actions/setup-node@v4`.

### Rationale
- `actions/setup-node@v4` has native support for pnpm caching when combined with `pnpm/action-setup`
- This is the officially recommended approach and handles the pnpm store location automatically
- Cache key is automatically generated from `pnpm-lock.yaml`

### Implementation
```yaml
- uses: pnpm/action-setup@v4
  # Version auto-detected from packageManager in package.json

- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Manual `actions/cache` | More verbose, error-prone, must maintain store path |
| Cache `node_modules` directly | Breaks pnpm's hard link optimization, bloats cache size |
| No caching | 2-3x slower installs (30-90s vs 5-15s) |

---

## 2. Running Commands Across Monorepo

### Decision
Use pnpm's built-in recursive commands via root package.json scripts.

### Rationale
- The project already uses this pattern (`"build": "pnpm -r build"` in root package.json)
- pnpm's recursive execution respects the workspace topology and runs commands in dependency order
- No additional tooling required (Turborepo/Nx would be overkill for 5 packages)

### Implementation
```yaml
- run: pnpm lint       # Runs eslint across monorepo
- run: pnpm typecheck  # Runs pnpm -r typecheck
- run: pnpm test       # Runs vitest run
- run: pnpm build      # Runs pnpm -r build
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Turborepo/Nx | New dependency, complexity overkill for 5 packages |
| Matrix build per package | GitHub Actions overhead (30-60s per job startup) |
| `pnpm --filter` for each package | Unnecessary verbosity |

---

## 3. Job Structure

### Decision
Single CI job with sequential steps for PR checks; separate Deploy job for main branch.

### Rationale
- For a 5-package monorepo with a 10-minute quality check target (SC-001), a single job reduces GitHub Actions overhead
- Job startup time is ~30-60 seconds per job; 3 parallel jobs = 1.5+ min overhead
- Sequential steps for lint/typecheck/test/build typically complete in 2-4 minutes total
- Separating deploy into its own job provides clear gate and allows different triggers

### Implementation
```yaml
jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  deploy:
    name: Deploy
    needs: ci
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    # ...deployment steps
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Parallel jobs (lint \|\| test \|\| build) | Job startup overhead exceeds time saved at this scale |
| Matrix build by package | 5 jobs = 2.5min overhead, complex |

---

## 4. AWS Credentials Configuration

### Decision
Use OIDC (OpenID Connect) with IAM Roles.

### Rationale
- **No long-lived credentials**: Eliminates need to store AWS access keys as GitHub secrets
- **Automatic rotation**: Tokens are short-lived (~1 hour) and automatically refreshed
- **Audit trail**: CloudTrail logs show exactly which GitHub repository/workflow assumed the role
- **AWS recommended**: This is the AWS-recommended approach since 2021

### Implementation

**AWS Setup Required:**
1. Create OIDC Identity Provider in AWS:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. Create IAM Role with Trust Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:ref:refs/heads/main"
      }
    }
  }]
}
```

**Workflow Configuration:**
```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubActions-CDK-Deploy
          aws-region: us-east-1
```

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| IAM Access Keys in GitHub Secrets | Long-lived credentials pose security risk; require manual rotation |
| AWS IAM Identity Center (SSO) | Over-engineered for single-account CI/CD |

---

## 5. CDK Bootstrap Requirements

### Decision
Bootstrap once manually; verify in CI optionally.

### Rationale
- Bootstrap creates foundational resources (S3 bucket, ECR repo, IAM roles) that CDK needs
- Bootstrap is a one-time operation per account/region, not a CI/CD step
- Running bootstrap in CI risks accidental modifications

### Bootstrap Command (Manual, One-Time)
```bash
cdk bootstrap aws://ACCOUNT_ID/us-east-1 \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

### Deployment Role Permissions
The OIDC role needs permissions to assume CDK bootstrap roles:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": [
      "arn:aws:iam::*:role/cdk-*-deploy-role-*",
      "arn:aws:iam::*:role/cdk-*-lookup-role-*",
      "arn:aws:iam::*:role/cdk-*-file-publishing-role-*"
    ]
  }]
}
```

---

## 6. CDK Context and Environment Variables

### Decision
Use CDK context via `-c` flags for configuration; environment variables for secrets.

### Rationale
- The existing CDK app (`packages/infra/bin/app.ts`) already supports both mechanisms
- Context flags are explicit and visible in CI logs
- Environment variables work well for secrets (won't appear in command logs)

### Implementation
```yaml
env:
  CDK_DEFAULT_ACCOUNT: ${{ secrets.AWS_ACCOUNT_ID }}
  CDK_DEFAULT_REGION: us-east-1
  GITHUB_WEBHOOK_SECRET: ${{ secrets.GITHUB_WEBHOOK_SECRET }}

steps:
  - name: CDK Deploy
    run: |
      cd packages/infra
      npx cdk deploy --require-approval never -c environment=prod
```

### Context vs Environment Variables
| Data Type | Mechanism |
|-----------|-----------|
| Environment name | Context (`-c environment=prod`) |
| Secrets | Environment variable |
| AWS account/region | Environment variable (`CDK_DEFAULT_*`) |

---

## 7. Error Handling and Rollback

### Decision
Rely on CDK/CloudFormation built-in rollback.

### Rationale
- CloudFormation automatically rolls back failed deployments to the last known good state
- CDK wraps CloudFormation, inheriting this behavior
- The spec clarifies: "Rely on CDK's built-in rollback (automatic on failure)"

### Behavior
- **Automatic rollback on failure**: If any resource fails to create/update, CloudFormation rolls back
- **Manual rollback if needed**: `cdk deploy --rollback` forces rollback of a stuck stack
- **Zero-downtime**: S3 + CloudFront architecture means content is always served during deploy

---

## 8. Concurrency and Cancel-in-Progress

### Decision
Use GitHub Actions concurrency groups with `cancel-in-progress: true`.

### Rationale
- The spec explicitly states: "Cancel in-progress deployment, run new one (latest wins)"
- Prevents race conditions; only one deployment can run at a time
- For PRs, canceling stale runs saves resources and provides faster feedback

### Implementation
```yaml
concurrency:
  group: "${{ github.workflow }} @ ${{ github.event.pull_request.head.label || github.head_ref || github.ref }}"
  cancel-in-progress: true
```

### Concurrency Group Patterns
| Component | Purpose |
|-----------|---------|
| `github.workflow` | Prevents different workflows from canceling each other |
| `github.event.pull_request.head.label` | PR branch with fork info |
| `github.head_ref` | Branch name for PRs from same repo |
| `github.ref` | Full ref for push events |

---

## 9. Status Checks and Notifications

### Decision
Rely on GitHub's built-in notification system: PR status checks plus commit status.

### Rationale
- The spec explicitly limits to "GitHub Actions native notifications (PR status checks, commit statuses)" (FR-010)
- Modern JS tools (ESLint, TypeScript, Vitest) natively support GitHub Actions annotations
- No additional configuration required for notifications

### How It Works
1. **PR Status Checks**: Automatically appear on PR page when workflow runs
2. **Commit Status**: Shows check/X/pending on commit list
3. **Branch Protection**: Configure required checks via repository settings

### Branch Protection Setup (Manual)
1. Enable branch protection on `main`
2. Check "Require status checks to pass before merging"
3. Select required checks: `CI` (the job name)

---

## Required GitHub Secrets

| Secret Name | Purpose |
|-------------|---------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of OIDC role for deployment |
| `WEBHOOK_SECRET` | Secret for GitHub webhook validation (cannot use `GITHUB_` prefix) |

---

## Files to Create

| File | Purpose |
|------|---------|
| `.github/workflows/ci-cd.yml` | Main CI/CD workflow |

---

## 10. Playwright E2E Testing in GitHub Actions

### Decision
Use Docker container approach with official Playwright image for e2e tests.

### Rationale
- **Eliminates browser installation time**: Standard `npx playwright install --with-deps` takes 2-3.5 minutes; Docker has browsers pre-installed
- **More reliable**: No apt-get failures or missing OS dependencies
- **Consistent environment**: Important for visual regression testing if added later
- **Official recommendation**: Playwright docs recommend Docker for CI environments

### Implementation
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  timeout-minutes: 15
  container:
    image: mcr.microsoft.com/playwright:v1.49.0-noble
    options: --user 1001 --ipc=host
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:e2e
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### Container Options Explained
| Option | Purpose |
|--------|---------|
| `--user 1001` | Ensures proper permissions during test execution |
| `--ipc=host` | Prevents Chromium from running out of memory and crashing |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| `npx playwright install --with-deps` | 2-3.5 minute overhead, can timeout |
| Caching browser binaries | Not recommended by Playwright; restoration time ≈ download time |
| `microsoft/playwright-github-action` | Deprecated and archived (Jan 2025) |

### Performance Impact
- Docker pull: ~15-30 seconds (cached after first run)
- Browser installation: 0 seconds (pre-installed)
- Total e2e job overhead vs non-Docker: **~2-3 minutes faster**

---

## Pre-Implementation Checklist

- [ ] AWS OIDC Identity Provider created
- [ ] IAM Role for GitHub Actions created with trust policy
- [ ] CDK bootstrapped in target account/region
- [ ] GitHub secrets configured (`AWS_DEPLOY_ROLE_ARN`, `AWS_ACCOUNT_ID`, `GITHUB_WEBHOOK_SECRET`)
- [ ] Branch protection rules configured on `main` after first workflow run
