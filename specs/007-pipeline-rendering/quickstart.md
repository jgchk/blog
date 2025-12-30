# Quickstart: Pipeline-Based Rendering

**Feature**: 007-pipeline-rendering
**Date**: 2025-12-30

## Overview

This guide covers local development and testing of the pipeline rendering feature.

## Prerequisites

- Node.js 20.x
- pnpm 8.15+
- AWS CLI configured (for local S3 testing)
- Git

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build Packages

```bash
pnpm build
```

### 3. Run Local Dev Server (Existing)

For content authoring and preview:

```bash
pnpm --filter @blog/dev-server dev
```

This uses the existing dev-server which renders on-demand.

### 4. Test Pipeline Rendering Locally

To test the full pipeline render locally:

```bash
# Render all posts to ./rendered directory
pnpm --filter @blog/renderer render:pipeline

# Or with specific output directory
pnpm --filter @blog/renderer render:pipeline --output ./dist
```

### 5. Verify Output

```bash
# Check rendered structure
ls -la rendered/
ls -la rendered/posts/
ls -la rendered/tags/

# Serve locally to preview
npx serve rendered
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run renderer tests only
pnpm --filter @blog/renderer test

# Run specific test file
pnpm --filter @blog/renderer test pipeline-renderer.test.ts
```

### E2E Tests (Dev Server)

```bash
pnpm test:e2e
```

### Smoke Tests (Against Live Site)

After deployment, smoke tests run automatically. For manual testing:

```bash
BASE_URL=https://your-cloudfront-domain.cloudfront.net pnpm test:e2e
```

## CI/CD Pipeline Flow

### Automatic Triggers

1. Push to `main` branch triggers CI/CD workflow
2. CI job runs lint, typecheck, tests, build
3. E2E job runs Playwright tests
4. Deploy job (on main only):
   - Builds all packages
   - Runs pipeline renderer
   - Uploads to S3
   - Invalidates CloudFront
5. Smoke tests verify live site

### Manual Testing of Pipeline

To test the full pipeline locally before merging:

```bash
# 1. Build everything
pnpm build

# 2. Run pipeline renderer
pnpm --filter @blog/renderer render:pipeline

# 3. Verify output
ls -la rendered/

# 4. (Optional) Upload to test bucket
aws s3 sync rendered/ s3://your-test-bucket/ --delete
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTS_DIR` | Source posts directory | `./posts` |
| `OUTPUT_DIR` | Local render output | `./rendered` |
| `S3_BUCKET` | Target S3 bucket | From CDK stack |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution | From CDK stack |

### GitHub Actions Secrets

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | OIDC role for AWS access |

## Troubleshooting

### Common Issues

#### "Permission denied" on S3 upload

Ensure OIDC role has correct permissions:
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`
- `cloudfront:CreateInvalidation`

#### Render fails for specific post

Check the error message for the failing file. Common causes:
- Invalid front matter YAML
- Missing required fields (title, date)
- Malformed markdown

```bash
# Validate a specific post
pnpm --filter @blog/renderer validate posts/problem-post/index.md
```

#### Assets not appearing

Ensure assets are in the same directory as `index.md`:
```
posts/my-post/
├── index.md
├── hero.jpg    # Correct
└── images/
    └── photo.jpg  # Also correct
```

#### CloudFront still showing old content

- Check invalidation status in AWS Console
- Invalidations typically complete in 1-2 minutes
- Use `aws cloudfront get-invalidation --distribution-id XXX --id YYY`

## Development Workflow

### Adding a New Post

1. Create directory: `posts/my-new-post/`
2. Create `index.md` with front matter
3. Add any images to the same directory
4. Commit and push to branch
5. Create PR to `main`
6. Merge triggers automatic deploy

### Updating Templates

1. Modify templates in `packages/site/`
2. Test locally with dev-server
3. Push changes
4. Deploy renders all posts with new templates

### Testing Infrastructure Changes

1. Modify `packages/infra/lib/blog-stack.ts`
2. Test with CDK diff:
   ```bash
   cd packages/infra
   npx cdk diff -c environment=prod
   ```
3. Deploy via PR merge to `main`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   posts/    │  │  packages/  │  │   .github/workflows/    │  │
│  │  (content)  │  │   (code)    │  │     ci-cd.yml          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Push to main
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │    CI    │→ │   E2E    │→ │  Deploy  │→ │   Smoke Tests    ││
│  │ lint,test│  │ Playwright│ │render,s3 │  │  live site       ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ S3 sync + CloudFront invalidation
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS                                      │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │        S3           │ ←─ │        CloudFront              │  │
│  │  blog-content-prod  │    │   CDN + HTTPS                  │  │
│  └─────────────────────┘    └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```
