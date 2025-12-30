# Research: Pipeline-Based Rendering

**Feature**: 007-pipeline-rendering
**Date**: 2025-12-30

## Research Questions

### 1. S3 Upload Strategy with Atomic Deployment

**Decision**: Use staging prefix pattern with upload ordering for atomic-like deployment

**Rationale**:
- S3 sync is not natively atomic; mid-sync failures can leave inconsistent state
- Staging prefix allows complete upload before making live
- Upload ordering (assets first, entry points last) ensures dependencies exist before HTML references them

**Pattern**:
```bash
# 1. Upload to staging prefix
aws s3 sync ./dist s3://bucket/staging/${TIMESTAMP}/ --delete

# 2. Atomic swap via CloudFront origin path update OR
# 3. Copy from staging to production root with asset-first ordering:
#    - Upload all non-HTML files first
#    - Then upload HTML files (entry points)
#    - Finally delete orphaned files
```

**Alternatives Considered**:
- **Blue-green with CloudFront origin path**: More complex, requires CloudFront API calls for each deploy
- **API Gateway stages**: Overkill for static site
- **Direct sync without staging**: Risk of partial deploys on failure

### 2. CloudFront Cache Invalidation

**Decision**: Use wildcard invalidation (`/*`) for full-site renders

**Rationale**:
- Full site rendering changes most or all files
- First 1,000 invalidation paths/month are free
- Wildcard counts as single path, simplifies workflow
- Smart invalidation adds complexity without benefit for full-site deploys

**Implementation**:
```yaml
- name: Invalidate CloudFront
  run: |
    aws cloudfront create-invalidation \
      --distribution-id ${{ env.CLOUDFRONT_DISTRIBUTION_ID }} \
      --paths "/*"
```

**Alternatives Considered**:
- **Specific path invalidation**: More complex for full-site deploys, no cost benefit within free tier
- **Content-hashed filenames only**: Would avoid invalidation but requires more complex asset pipeline

### 3. Running TypeScript Rendering in GitHub Actions

**Decision**: Pre-compile TypeScript and run with Node.js

**Rationale**:
- Existing build step already compiles TypeScript
- Running compiled JS is faster than ts-node/tsx
- Consistent with existing monorepo patterns
- No additional dependencies needed

**Implementation**:
```yaml
- name: Build packages
  run: pnpm build

- name: Render site
  run: node packages/renderer/dist/pipeline.mjs
```

**Alternatives Considered**:
- **tsx/ts-node**: Slower startup, additional runtime dependency
- **Bundled script with ncc**: Adds build complexity for minimal benefit

### 4. AWS Credential Management

**Decision**: Use OIDC (already configured in existing CI/CD pipeline)

**Rationale**:
- Already implemented in 005-ci-cd-pipeline feature
- Short-lived credentials, no secrets to rotate
- Scoped to main branch for production deploys
- AWS and GitHub recommended approach

**Existing Configuration** (from `.github/workflows/ci-cd.yml`):
```yaml
permissions:
  id-token: write
  contents: read

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
    aws-region: us-east-1
```

**No Changes Required**: Existing OIDC setup is sufficient

### 5. Staging-to-Production Swap Strategy

**Decision**: Direct sync with asset-first ordering (no prefix staging)

**Rationale**:
- Full-site renders replace all content anyway
- S3 versioning provides rollback capability
- Asset-first ordering prevents broken references during sync
- Simpler than prefix-based blue-green

**Implementation**:
```bash
# Upload in correct order:
# 1. Assets and non-HTML files (can be parallel)
# 2. HTML files last (depends on assets existing)
# 3. Delete orphaned files

aws s3 sync ./rendered s3://bucket \
  --exclude "*.html" \
  --delete

aws s3 sync ./rendered s3://bucket \
  --include "*.html" \
  --delete
```

**Alternatives Considered**:
- **Staging prefix with CloudFront origin switch**: More complex, CloudFront propagation delay
- **Atomic S3 operations**: Not available for sync operations

### 6. Error Handling and Fail-Fast

**Decision**: Fail entire pipeline on any render error

**Rationale**:
- Spec FR-007 requires fail-fast on render errors
- Constitution violation (skip invalid files) is justified for site consistency
- Partial deploys would leave broken links, missing tag entries
- GitHub Actions naturally surfaces errors

**Implementation**:
- Pipeline script throws on render error
- GitHub Actions step fails, blocking subsequent steps
- Actionable error message identifies failing file

**Alternatives Considered**:
- **Skip invalid, continue with valid**: Violates FR-007, risks inconsistent site state
- **Rollback on error**: Adds complexity; easier to fix source and re-deploy

### 7. Architecture Simplification

**Decision**: Remove webhook infrastructure entirely from CDK stack

**Rationale**:
- Webhook Lambda, API Gateway, SNS no longer needed
- Reduces AWS costs and operational complexity
- Aligns with Constitution IV (Minimal Complexity)
- CDK stack becomes purely S3 + CloudFront

**Components to Remove**:
- `blog-render-{env}` Lambda function
- `blog-admin-{env}` Lambda function
- API Gateway with `/webhook/github` and `/admin/*` endpoints
- SNS topic (`blog-alerts-{env}`)
- Lambda execution roles and policies
- Webhook configuration in GitHub Actions deploy step

**Components to Retain**:
- S3 bucket (`blog-content-{environment}-{account}`)
- CloudFront distribution
- OIDC provider and deploy role

### 8. Pipeline Rendering Performance

**Decision**: Sequential rendering with progress logging

**Rationale**:
- 500 posts in <10 minutes is achievable with sequential processing
- Parallel rendering adds complexity without clear need
- GitHub Actions provides 7GB RAM and multi-core CPU
- Progress logging essential for SC-004 (actionable errors in <60s)

**Performance Estimate**:
- ~1 second per post (render + write) = ~500 seconds for 500 posts
- Tag page generation: ~10 seconds
- S3 upload: ~60 seconds for 500 posts
- CloudFront invalidation: ~5 seconds to initiate
- Total: ~10 minutes with margin

**Optimization Path (if needed)**:
- Parallel file reading with streaming
- Batch S3 operations
- Worker pool for rendering (future enhancement, not needed now)

## Summary

| Question | Decision | Complexity |
|----------|----------|------------|
| S3 upload | Asset-first ordering, direct sync | Low |
| CloudFront | Wildcard invalidation | Low |
| TypeScript execution | Pre-compiled, node.js | Low |
| AWS credentials | OIDC (existing) | None (reuse) |
| Staging pattern | No staging, ordered sync | Low |
| Error handling | Fail-fast, block deploy | Low |
| Architecture | Remove webhooks, retain S3/CF | Medium |
| Performance | Sequential with logging | Low |

All decisions favor simplicity, aligning with Constitution IV (Minimal Complexity).
