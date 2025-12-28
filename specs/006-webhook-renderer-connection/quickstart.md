# Quickstart: Webhook Renderer Connection

**Branch**: `006-webhook-renderer-connection`
**Date**: 2025-12-26

## Overview

This document provides a quick reference for implementing the webhook-renderer connection. Full details are in the research, data model, and contract documents.

---

## Implementation Order

### 1. GitHubContentFetcher (Adapter)

**Location**: `packages/renderer/src/adapters/github-content.ts`

**Purpose**: Fetch post content and assets from GitHub.

**Key Methods**:
```typescript
class GitHubContentFetcher {
  async fetchFile(repo: RepositoryRef, path: string): Promise<GitHubFile | null>;
  async listDirectory(repo: RepositoryRef, path: string): Promise<GitHubDirectoryEntry[]>;
  async listPostSlugs(repo: RepositoryRef): Promise<string[]>;
  async fetchPostFiles(repo: RepositoryRef, slug: string): Promise<GitHubFile[]>;
}
```

**Implementation Notes**:
- Use `fetch()` (native Node.js 20)
- Raw content URL: `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`
- Directory listing: `https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}`
- Handle 404 for missing files (return null, don't throw)

**Tests**: `packages/renderer/tests/unit/adapters/github-content.test.ts`

---

### 2. SyncOrchestrator (Service)

**Location**: `packages/renderer/src/services/sync-orchestrator.ts`

**Purpose**: Coordinate the end-to-end sync process.

**Key Methods**:
```typescript
class SyncOrchestrator {
  async sync(request: SyncRequest): Promise<SyncResult>;
  getCurrentSync(): SyncStatus | null;
  isSyncInProgress(): boolean;
}
```

**Dependencies**:
- `GitHubContentFetcher` - fetch content
- `RenderService` - render articles, copy assets, tag pages
- `SyncTracker` - track progress
- `SNSNotificationAdapter` - send notifications
- `CloudFrontClient` - invalidate cache

**Sync Flow**:
```
1. syncTracker.startSync(syncId, commitHash)
2. For incremental: process changes.added, changes.modified
   For full: listPostSlugs() → process all
3. For each post:
   a. fetchPostFiles(slug)
   b. renderService.renderArticle(content, slug)
   c. renderService.publishArticleWithRetry(article)
   d. renderService.copyAssets(slug)
4. For removed posts: delete from S3
5. renderService.publishAllTagsPage(articles)
6. renderService.publishAllTagPages(tagIndex, articles)
7. cloudfront.createInvalidation(paths)
8. notifier.send(notification)
9. syncTracker.completeSync(...)
```

**Tests**:
- Unit: `packages/renderer/tests/unit/services/sync-orchestrator.test.ts`
- Integration: `packages/renderer/tests/integration/sync-orchestrator.test.ts`

---

### 3. Update Webhook Handler

**Location**: `packages/renderer/src/handlers/webhook.ts`

**Changes**:
- Inject `SyncOrchestrator` dependency
- Call `orchestrator.sync()` instead of just acknowledging
- Extract repository info from payload

**Before** (current):
```typescript
// TODO: Trigger async rendering process
// For now, just acknowledge the webhook
return this.jsonResponse(200, { syncId, status: 'accepted', ... });
```

**After**:
```typescript
const request: SyncRequest = {
  type: 'incremental',
  repository: this.parseRepository(payload.repository),
  changes: affectedFiles,
  commitHash: payload.commits[0]?.id,
};

const result = await this.orchestrator.sync(request);

return this.jsonResponse(200, {
  syncId: result.syncId,
  status: result.success ? 'accepted' : 'failed',
  message: `Processed ${result.articlesRendered.length} articles`,
});
```

**Tests**: Update `packages/renderer/tests/contract/webhook.test.ts`

---

### 4. Update Admin Handler

**Location**: `packages/renderer/src/handlers/admin.ts`

**Changes**: Add `POST /admin/render` endpoint

```typescript
async triggerFullRender(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (this.orchestrator.isSyncInProgress()) {
    return this.errorResponse(409, 'Render already in progress');
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const repository = body.repository || process.env.GITHUB_REPOSITORY;

  const request: SyncRequest = {
    type: 'full',
    repository: this.parseRepository(repository),
    force: body.force ?? false,
  };

  const result = await this.orchestrator.sync(request);

  return this.jsonResponse(202, {
    syncId: result.syncId,
    status: 'accepted',
    message: `Full render complete: ${result.articlesRendered.length} articles`,
  });
}
```

**Tests**: Update `packages/renderer/tests/contract/admin-api.test.ts`

---

### 5. Update CDK Stack

**Location**: `packages/infra/lib/blog-stack.ts`

**Changes**:

1. Add environment variable:
```typescript
environment: {
  // ... existing
  GITHUB_REPOSITORY: 'owner/blog-content',  // or from props
}
```

2. Increase render Lambda timeout for full renders:
```typescript
const renderFunction = new lambda.Function(this, 'RenderFunction', {
  // ... existing
  timeout: cdk.Duration.minutes(5),  // Increased from 30 seconds
});
```

3. Add admin render route:
```typescript
// /admin/render
const renderResource = adminResource.addResource('render');
renderResource.addMethod('POST', adminIntegration, {
  authorizationType: apigateway.AuthorizationType.IAM,
});
```

**Note**: Consider using render Lambda for full renders instead of admin Lambda due to timeout needs.

---

### 6. Update Handler Exports

**Location**: `packages/renderer/src/handlers/index.ts`

Ensure handlers are properly exported with dependencies injected:

```typescript
import { SyncOrchestrator } from '../services/sync-orchestrator.js';
import { GitHubContentFetcher } from '../adapters/github-content.js';
// ... other imports

// Initialize dependencies
const contentFetcher = new GitHubContentFetcher();
const storage = new S3StorageAdapter(process.env.S3_BUCKET!);
const notifier = new SNSNotificationAdapter(process.env.SNS_TOPIC_ARN!);
const syncTracker = new SyncTracker();
const renderService = new RenderService(storage);

const orchestrator = new SyncOrchestrator({
  contentFetcher,
  storage,
  notifier,
  distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID!,
  renderService,
  syncTracker,
});

// Export handlers
export const handleWebhook = new GitHubWebhookHandler(
  process.env.GITHUB_WEBHOOK_SECRET!,
  'main',
  orchestrator
).handle.bind(webhookHandler);

export const handleAdmin = new AdminHandler(
  syncTracker,
  orchestrator
).route.bind(adminHandler);
```

---

## Testing Checklist

### Unit Tests
- [ ] GitHubContentFetcher.fetchFile
- [ ] GitHubContentFetcher.listDirectory
- [ ] GitHubContentFetcher.listPostSlugs
- [ ] GitHubContentFetcher.fetchPostFiles
- [ ] SyncOrchestrator.sync (incremental)
- [ ] SyncOrchestrator.sync (full)
- [ ] SyncOrchestrator handles deletions
- [ ] SyncOrchestrator sends notifications

### Contract Tests
- [ ] POST /webhook/github triggers sync
- [ ] POST /admin/render triggers full sync
- [ ] POST /admin/render returns 409 when sync in progress

### Integration Tests
- [ ] Full sync flow with mocked GitHub
- [ ] Incremental sync with add/modify/delete
- [ ] Tag pages regenerated after sync

---

## Environment Variables

| Variable | Lambda | Description |
|----------|--------|-------------|
| `S3_BUCKET` | Both | Target S3 bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | Render | CDN distribution |
| `GITHUB_WEBHOOK_SECRET` | Render | Webhook signature validation |
| `SNS_TOPIC_ARN` | Render | Notification topic |
| `GITHUB_REPOSITORY` | Render | Default repo for admin ops |
| `NODE_ENV` | Both | Environment name |

---

## Quick Validation

After implementation:

1. **Local test**: Run `pnpm test` in `packages/renderer`
2. **Deploy**: `cd packages/infra && cdk deploy`
3. **Test webhook**: Push a post change to main branch
4. **Check results**:
   - S3 bucket has new `articles/{slug}/index.html`
   - CloudFront serves updated content
   - SNS notification received

---

## Common Issues

### Timeout on full render
- Increase Lambda timeout in CDK (up to 15 minutes max)
- Consider breaking into smaller batches if >500 posts

### GitHub API rate limit
- Public repos: 60 requests/hour unauthenticated
- Use raw.githubusercontent.com for file content (no rate limit)
- Use API only for directory listings

### CloudFront cache not updating
- Check invalidation completed (can take 1-2 minutes)
- Verify correct paths in invalidation request
- Check distribution ID matches
