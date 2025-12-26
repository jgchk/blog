# Research: Webhook Renderer Connection

**Branch**: `006-webhook-renderer-connection`
**Date**: 2025-12-26
**Status**: Complete

## Executive Summary

This research resolves all technical decisions needed to connect the existing GitHub webhook handler to the rendering pipeline. The existing infrastructure (webhook signature validation, RenderService, S3StorageAdapter, SNS notifications, SyncTracker) provides a solid foundation. The primary work involves:

1. Creating a GitHubContentFetcher to retrieve post content from the repository
2. Orchestrating the sync process that connects webhook events to rendering
3. Adding a full-render admin endpoint
4. Handling post deletions

---

## Research Topics

### 1. How to Fetch Post Content from GitHub

**Context**: The webhook handler receives push events with file paths, but needs to fetch actual content from the repository.

**Decision**: Use GitHub's raw content API (raw.githubusercontent.com) for public repositories

**Rationale**:
- The repository is public (per spec assumptions), so no authentication needed
- Raw content API is simpler than GitHub REST/GraphQL API for file fetching
- Pattern: `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}`
- For listing directory contents, use GitHub REST API: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
- This approach avoids adding octokit dependency (simpler than originally planned)

**Alternatives Considered**:
- **Octokit/GitHub REST API**: More powerful but overkill for simple file fetching. Would require managing API rate limits. Rejected for simplicity.
- **Clone repository**: Would require git on Lambda, significantly more complex. Rejected for complexity.
- **GitHub Archive API**: Useful for full repo snapshots but excessive for incremental changes. Rejected as overkill.

**Implementation**:
```typescript
// For individual files (raw content)
const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
const response = await fetch(url);

// For directory listing (GitHub API)
const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
const response = await fetch(url, {
  headers: { 'Accept': 'application/vnd.github.v3+json' }
});
```

---

### 2. Sync Orchestration Strategy

**Context**: Need to connect webhook events to the rendering pipeline in a way that handles errors gracefully and tracks progress.

**Decision**: Create a `SyncOrchestrator` service that coordinates the end-to-end sync process

**Rationale**:
- Single responsibility: orchestrator manages flow, individual services do work
- Clear error boundaries: each step can fail independently
- Testable: orchestrator can be unit tested with mocked dependencies
- Reusable: same orchestrator can handle both incremental and full renders

**Orchestration Flow**:
```
1. Webhook receives push event
2. Create sync operation (SyncTracker)
3. For each affected post:
   a. Fetch content from GitHub
   b. Render article (RenderService)
   c. Copy assets (RenderService)
   d. Track success/failure
4. Handle deletions (remove from S3)
5. Regenerate tag pages (RenderService)
6. Send notification (SNS)
7. Invalidate CloudFront cache
8. Complete sync operation (SyncTracker)
```

**Alternatives Considered**:
- **Inline in webhook handler**: Would make handler too complex and hard to test. Rejected for maintainability.
- **Step Functions**: More robust for long-running processes but adds AWS complexity. Rejected per minimal complexity principle.
- **SQS queue + separate worker**: Better for scale but overkill for ~500 posts. Rejected per YAGNI.

---

### 3. Post Deletion Handling

**Context**: When a post is deleted from the repository, its rendered content and assets must be removed from S3.

**Decision**: Delete all S3 objects with prefix `articles/{slug}/`

**Rationale**:
- Simple prefix-based deletion handles both HTML and assets
- S3's ListObjectsV2 + DeleteObjects pattern handles this efficiently
- StorageAdapter already has `delete()` method; need to add `deletePrefix()` or iterate over list

**Implementation**:
```typescript
async deletePost(slug: string): Promise<void> {
  const prefix = `articles/${slug}/`;
  const keys = await this.storage.list(prefix);
  for (const key of keys) {
    await this.storage.delete(key);
  }
}
```

**Alternatives Considered**:
- **Track assets separately**: Would require maintaining asset manifest. Rejected for complexity.
- **Soft delete (rename)**: Would allow recovery but complicates storage. Rejected per YAGNI.

---

### 4. Full Site Render Admin Endpoint

**Context**: FR-004 requires an admin endpoint to trigger full site rendering for initial deployment and recovery.

**Decision**: Add `POST /admin/render` endpoint with IAM authentication

**Rationale**:
- Consistent with existing admin endpoint pattern (IAM auth)
- Same handler can be used, just with different path parameter
- Can reuse SyncOrchestrator with "full render" mode

**API Contract**:
```yaml
POST /admin/render
  Auth: IAM
  Body: { "force": boolean }  # Optional: re-render even if unchanged
  Response: { "syncId": string, "status": "accepted" }
```

**Timeout Consideration**: Full render of 500 posts may exceed Lambda's 30-second timeout. Solution:
- Increase render Lambda timeout to 5-10 minutes for admin operations
- Or: Use async pattern where endpoint queues work and returns immediately

**Decision**: Start synchronous, increase timeout. Add async pattern only if needed.

---

### 5. Lambda Timeout Strategy

**Context**: Webhook responses should be fast (<60s for GitHub), but full renders may be longer.

**Decision**: Different timeout configurations for webhook vs admin Lambdas

**Rationale**:
- Webhook Lambda: Keep at 30 seconds (current) - responds quickly, can offload long work if needed
- Admin Lambda: Increase to 5-10 minutes for full renders
- Alternative: Both use same Lambda, but that complicates timeout management

**Implementation**: Update CDK stack to have different timeouts:
```typescript
// Webhook: 30 seconds (quick response)
// Admin (render): 5-10 minutes (full render)
```

**Future consideration**: If webhooks need to render many posts (e.g., bulk import), could use SQS to decouple webhook response from rendering work.

---

### 6. Tag Page Regeneration Strategy

**Context**: FR-011 requires tag pages to be regenerated on every render to keep navigation consistent.

**Decision**: Always regenerate all tag pages after any sync operation

**Rationale**:
- Tag relationships change when posts are added/modified/deleted
- Full regeneration is simpler than tracking which tags changed
- 500 posts with ~10 unique tags means ~10 tag pages - fast enough
- Existing `publishAllTagPages()` method handles this

**Flow**:
```
1. Complete all article renders
2. Collect all successfully rendered articles
3. Build TagIndex from articles
4. Call publishAllTagsPage(articles)
5. Call publishAllTagPages(tagIndex, articles)
```

**Alternatives Considered**:
- **Incremental tag update**: Track which tags changed and only update those. Rejected for complexity.
- **Defer to background job**: Would complicate architecture. Rejected per YAGNI.

---

### 7. CloudFront Cache Invalidation

**Context**: Rendered content is served via CloudFront CDN, which caches responses.

**Decision**: Invalidate specific paths after render, with wildcard for deleted posts

**Rationale**:
- Invalidating `/*` is expensive (AWS charges per invalidation request)
- Targeted invalidation of changed paths is more efficient
- AWS allows 1000 free invalidation paths per month

**Implementation**:
```typescript
const paths: string[] = [];
// For rendered posts
paths.push(`/articles/${slug}/*`);
// For tag pages (always invalidate)
paths.push('/tags/*');
// For archive (if updated)
paths.push('/archive.html');

await cloudfront.createInvalidation({
  DistributionId: distributionId,
  InvalidationBatch: {
    Paths: { Quantity: paths.length, Items: paths },
    CallerReference: syncId
  }
});
```

---

### 8. Error Handling and Notification Strategy

**Context**: FR-008 requires notifications on render completion or failure.

**Decision**: Use existing SNS notification adapter with structured messages

**Rationale**:
- SNSNotificationAdapter already exists and works
- CDK grants publish permission to render Lambda
- Add structured success/failure messages per spec

**Notification Format**:
```typescript
// Success
{
  subject: "Blog Sync Completed",
  body: "Sync ${syncId} completed successfully.\n${articlesProcessed} articles processed.",
  severity: "info",
  metadata: { syncId, articlesProcessed, articlesFailed }
}

// Failure
{
  subject: "Blog Sync Failed",
  body: "Sync ${syncId} failed.\n${errorMessage}",
  severity: "error",
  metadata: { syncId, errorDetails }
}
```

---

### 9. Repository Information Discovery

**Context**: Need to know repository owner/name to construct GitHub URLs.

**Decision**: Extract from webhook payload's `repository.full_name` field

**Rationale**:
- Push event payload contains `repository.full_name` (e.g., "owner/repo")
- Also contains `repository.clone_url` if needed
- No additional configuration required

**Fallback**: Environment variable `GITHUB_REPOSITORY` for admin full-render endpoint (where no webhook payload exists).

---

### 10. Dependency Selection: Native Fetch vs Axios

**Context**: Need HTTP client for fetching content from GitHub.

**Decision**: Use native `fetch` (built into Node.js 20.x)

**Rationale**:
- Node.js 20.x includes native fetch (no dependency needed)
- Simple use case: GET requests for text/binary content
- Constitution principle: prefer standard library over third-party

**Alternatives Considered**:
- **Axios**: Popular but unnecessary dependency. Rejected per minimal complexity.
- **node-fetch**: Was needed pre-Node.js 18, now redundant. Rejected.

---

## Summary of Technical Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Content fetching | raw.githubusercontent.com + GitHub API | No auth needed, simpler than octokit |
| Sync orchestration | New SyncOrchestrator service | Single responsibility, testable |
| Post deletion | S3 prefix-based deletion | Simple and complete |
| Full render | POST /admin/render with IAM | Consistent with existing pattern |
| Lambda timeout | Different per function type | Webhook fast, admin long |
| Tag regeneration | Full regeneration on every sync | Simpler than incremental |
| Cache invalidation | Targeted path invalidation | Cost-effective |
| Notifications | Existing SNS adapter | Already built |
| Repository info | From webhook payload | No extra config needed |
| HTTP client | Native fetch | Built into Node.js 20 |

---

## New Components Required

1. **GitHubContentFetcher** (`@blog/renderer/src/adapters/github-content.ts`)
   - Fetch individual files from raw.githubusercontent.com
   - List directory contents via GitHub API
   - Handle binary assets (images)

2. **SyncOrchestrator** (`@blog/renderer/src/services/sync-orchestrator.ts`)
   - Coordinate incremental sync (from webhook)
   - Coordinate full sync (from admin)
   - Track progress via SyncTracker
   - Send notifications via SNS adapter
   - Invalidate CloudFront cache

3. **Updated Webhook Handler**
   - Call SyncOrchestrator instead of just acknowledging
   - Pass repository info and affected files

4. **Updated Admin Handler**
   - Add `POST /admin/render` endpoint
   - Trigger full sync via SyncOrchestrator

5. **Updated CDK Stack**
   - Add GITHUB_REPOSITORY environment variable
   - Increase admin Lambda timeout
   - Add `/admin/render` route

---

## Testing Strategy

Per constitution Test Confidence principle:

1. **Unit Tests**
   - GitHubContentFetcher: mock fetch responses
   - SyncOrchestrator: mock all dependencies, test flow

2. **Contract Tests**
   - Webhook handler contract (existing, extend for new behavior)
   - Admin handler contract for new render endpoint

3. **Integration Tests**
   - Full sync flow with mocked GitHub/AWS
   - Verify all steps execute in order

4. **E2E Tests** (optional, expensive)
   - Could add test that pushes to test repo and verifies render
   - May defer per test pyramid discipline
