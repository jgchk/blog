# Quickstart: CI/CD Pipeline Setup

**Feature Branch**: `005-ci-cd-pipeline`

This guide walks through setting up the CI/CD pipeline for the blog.

---

## Prerequisites

- [ ] AWS account with administrative access
- [ ] GitHub repository with admin access
- [ ] AWS CLI installed and configured locally
- [ ] CDK CLI installed (`npm install -g aws-cdk`)

---

## Step 1: Bootstrap CDK (One-Time)

If not already done, bootstrap CDK in your AWS account:

```bash
# Set your account ID and region
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1

# Bootstrap CDK
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

---

## Step 2: Create OIDC Identity Provider in AWS

### Via AWS Console:
1. Go to IAM → Identity providers → Add provider
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: `sts.amazonaws.com`
5. Click **Add provider**

### Via AWS CLI:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

---

## Step 3: Create IAM Role for GitHub Actions

### 3.1 Create the trust policy file

Create `trust-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Replace:
- `YOUR_ACCOUNT_ID` with your AWS account ID
- `YOUR_ORG/YOUR_REPO` with your GitHub org/repo (e.g., `jake-cheek/blog`)

### 3.2 Create the role

```bash
aws iam create-role \
  --role-name GitHubActions-CDK-Deploy \
  --assume-role-policy-document file://trust-policy.json
```

### 3.3 Attach the CDK deployment policy

Create `deploy-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeCDKRoles",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": [
        "arn:aws:iam::*:role/cdk-*-deploy-role-*",
        "arn:aws:iam::*:role/cdk-*-lookup-role-*",
        "arn:aws:iam::*:role/cdk-*-file-publishing-role-*",
        "arn:aws:iam::*:role/cdk-*-image-publishing-role-*"
      ]
    }
  ]
}
```

```bash
aws iam put-role-policy \
  --role-name GitHubActions-CDK-Deploy \
  --policy-name CDKDeployPolicy \
  --policy-document file://deploy-policy.json
```

### 3.4 Get the role ARN

```bash
aws iam get-role --role-name GitHubActions-CDK-Deploy --query 'Role.Arn' --output text
```

Save this ARN for Step 4.

---

## Step 4: Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActions-CDK-Deploy` |
| `GITHUB_WEBHOOK_SECRET` | Your GitHub webhook secret (used by the blog render Lambda) |

---

## Step 5: Create the Workflow File

Create `.github/workflows/ci-cd.yml` with the contents from `contracts/ci-cd-workflow.yml`.

```bash
mkdir -p .github/workflows
cp specs/005-ci-cd-pipeline/contracts/ci-cd-workflow.yml .github/workflows/ci-cd.yml
```

---

## Step 6: Test the Pipeline

### Test PR Checks:
1. Create a new branch
2. Make a small change
3. Push and create a PR
4. Verify the CI job runs and shows status on the PR

### Test Deployment:
1. Merge the PR to main
2. Verify the Deploy job runs after CI passes
3. Check that CDK deploy succeeds in the workflow logs
4. Verify the blog is updated

---

## Step 7: Configure Branch Protection (Optional but Recommended)

1. Go to repository → Settings → Branches
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable:
   - [x] Require status checks to pass before merging
   - [x] Require branches to be up to date before merging
5. Select required status checks: `CI`
6. Click **Create**

---

## Troubleshooting

### "Could not assume role" error
- Verify the OIDC provider is created correctly
- Check the trust policy matches your repo name exactly
- Ensure the workflow has `permissions: id-token: write`

### CDK deploy fails with permission error
- Verify CDK is bootstrapped in the target account/region
- Check the deploy role has the CDK policy attached
- Run `cdk bootstrap` again if needed

### Workflow not triggering
- Check that the workflow file is in `.github/workflows/`
- Verify the `on:` triggers match your branch names
- Check for YAML syntax errors

### Cache not working
- Verify `pnpm-lock.yaml` exists and is committed
- Check that `pnpm/action-setup` runs before `actions/setup-node`

---

## Verification Checklist

After setup, verify:

- [ ] PR to main triggers CI job
- [ ] CI job completes lint, typecheck, test, build steps
- [ ] Failed lint/test blocks PR merge (after branch protection enabled)
- [ ] Merge to main triggers Deploy job
- [ ] Deploy job successfully runs `cdk deploy`
- [ ] Blog is updated after successful deployment
