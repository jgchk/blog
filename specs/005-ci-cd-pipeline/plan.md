# Implementation Plan: CI/CD Pipeline for Blog Deployment

**Branch**: `005-ci-cd-pipeline` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-ci-cd-pipeline/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a GitHub Actions CI/CD pipeline that automatically runs lint, test, and build on pull requests, and deploys to AWS via CDK when changes merge to main. The pipeline uses the existing monorepo structure with pnpm workspaces and deploys the `@blog/infra` CDK stack.

## Technical Context

**Language/Version**: TypeScript 5.3+ targeting ES2022 on Node.js 20.x
**Primary Dependencies**: GitHub Actions, AWS CDK 2.120.0, pnpm 8.15.0
**Storage**: N/A (workflow files stored in `.github/workflows/`)
**Testing**: Vitest (unit), Playwright (e2e), ESLint (lint)
**Target Platform**: GitHub Actions runners (ubuntu-latest), deploying to AWS (Lambda Node.js 20.x)
**Project Type**: Monorepo with pnpm workspaces
**Performance Goals**: Quality checks within 10 minutes, full deployment within 20 minutes (per SC-001, SC-003)
**Constraints**: AWS credentials via GitHub secrets, CDK bootstrap required in target account
**Scale/Scope**: Single production environment, 5 packages in monorepo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Author Simplicity
- ✅ **PASS**: CI/CD is infrastructure that supports friction-free publishing. Authors still just write markdown; the pipeline handles deployment automatically when changes merge.
- No new manual steps introduced for content authors.

### II. Reader Simplicity
- ✅ **PASS**: Pipeline changes are invisible to readers. Zero-downtime deployment (SC-005) ensures readers always see content.
- No impact on page load times or reading experience.

### III. Test Confidence
- ✅ **PASS**: The pipeline enforces test confidence by gating deployments on passing tests (FR-003, FR-004).
- Aligns perfectly with "passing test suite means the feature works" principle.

### IV. Minimal Complexity
- ✅ **PASS**: Uses standard GitHub Actions (no custom actions), existing CDK stack, existing pnpm commands.
- Single workflow file for CI, one for CD (or combined with job dependencies).
- No new abstractions or dependencies beyond GitHub Actions YAML.

### V. Incremental Development
- ✅ **PASS**: Pipeline can be built incrementally:
  1. PR checks (lint/test) first
  2. Build verification second
  3. Deployment automation third
- Each stage is independently valuable and testable.

## Project Structure

### Documentation (this feature)

```text
specs/005-ci-cd-pipeline/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci-cd.yml        # New: GitHub Actions workflow for CI/CD

packages/
├── core/                # Existing: blog core library
├── dev-server/          # Existing: local development server
├── infra/               # Existing: CDK infrastructure (deployment target)
│   ├── bin/app.ts
│   └── lib/blog-stack.ts
├── renderer/            # Existing: Lambda rendering code
└── site/                # Existing: site templates and assets
```

**Structure Decision**: Infrastructure-as-code approach. This feature adds only workflow configuration files to `.github/workflows/`. The pipeline orchestrates existing packages and commands—no changes to source code structure are needed.

## Complexity Tracking

> **No violations.** All constitution principles pass.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

### I. Author Simplicity ✅
- **Verified**: No changes to author workflow. Markdown files are still the only input.
- Pipeline runs automatically; authors don't interact with it.

### II. Reader Simplicity ✅
- **Verified**: No reader-facing changes. S3 + CloudFront architecture unchanged.
- Zero-downtime deployment: CloudFront serves cached content during CDK deploy.

### III. Test Confidence ✅
- **Verified**: Pipeline enforces existing test suite as deployment gate.
- `pnpm test` runs in CI job; deploy blocked if tests fail (FR-004).

### IV. Minimal Complexity ✅
- **Verified**: Design uses only:
  - Standard GitHub Actions (checkout, setup-node, pnpm/action-setup, aws-configure-credentials)
  - Existing CDK stack with no modifications
  - Existing pnpm scripts
- Single workflow file (~100 lines YAML)
- No custom actions, no new abstractions

### V. Incremental Development ✅
- **Verified**: Implementation can proceed in increments:
  1. Create workflow file with CI job only
  2. Add deploy job
  3. Configure AWS OIDC and secrets
  4. Enable branch protection
- Each increment is independently testable

---

## Generated Artifacts

| Artifact | Purpose |
|----------|---------|
| `research.md` | Research findings for GitHub Actions, pnpm, CDK, OIDC |
| `data-model.md` | Workflow structure and entity relationships |
| `quickstart.md` | Step-by-step setup guide |
| `contracts/ci-cd-workflow.yml` | Target workflow configuration |
| `contracts/aws-oidc-trust-policy.json` | IAM trust policy for OIDC |
| `contracts/aws-deploy-role-policy.json` | IAM permissions for CDK deployment |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list.
