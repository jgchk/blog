# Data Model: Webhook Renderer Connection

**Branch**: `006-webhook-renderer-connection`
**Date**: 2025-12-26
**Status**: Complete

## Overview

This feature extends the existing data model with entities for GitHub content fetching and sync orchestration. The core entities (Article, Tag, SyncStatus) already exist in `@blog/core`.

---

## Existing Entities (No Changes Needed)

### Article (`@blog/core/src/models/article.ts`)

Already defined with all required fields for rendering and publishing.

```typescript
interface Article {
  slug: string;           // From folder name: posts/{slug}/index.md
  title: string;          // From front matter
  date: Date;             // From front matter
  content: string;        // Raw markdown (no front matter)
  html: string;           // Rendered HTML
  tags: string[];         // Tag slugs
  aliases: string[];      // Cross-link aliases
  draft: boolean;         // Exclude from publication
  excerpt: string;        // Auto-generated or custom
  sourcePath: string;     // posts/{slug}/index.md
  updatedAt: Date;        // Last modified
}
```

### SyncStatus (`@blog/core/src/models/sync-status.ts`)

Already defined for tracking sync operations.

```typescript
interface SyncStatus {
  syncId: string;
  commitHash: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  articlesProcessed: number;
  articlesFailed: number;
  errors: SyncError[];
  consecutiveFailures: number;
  startedAt: Date;
  completedAt: Date | null;
}

interface SyncError {
  articleSlug: string;
  errorType: 'parse' | 'render' | 'storage' | 'unknown';
  message: string;
  stack?: string;
}
```

### Tag (`@blog/core/src/models/tag.ts`)

Already defined for tag pages.

```typescript
interface Tag {
  slug: string;   // Normalized lowercase
  name: string;   // Display name
}
```

---

## New Entities

### GitHubFile

Represents a file fetched from the GitHub repository.

**Location**: `@blog/renderer/src/adapters/github-content.ts`

```typescript
/**
 * A file fetched from GitHub repository.
 */
interface GitHubFile {
  /** File path relative to repository root (e.g., "posts/hello-world/index.md") */
  path: string;

  /** File content as buffer (supports text and binary) */
  content: Buffer;

  /** File size in bytes */
  size: number;

  /** SHA hash for cache validation (optional) */
  sha?: string;
}
```

**Validation Rules**:
- `path` must be a valid relative path (no leading slash)
- `content` must be non-empty for files (directories not represented)
- `size` must match `content.length`

### GitHubDirectoryEntry

Represents an entry in a GitHub directory listing.

**Location**: `@blog/renderer/src/adapters/github-content.ts`

```typescript
/**
 * Entry in a GitHub directory listing.
 */
interface GitHubDirectoryEntry {
  /** File or directory name */
  name: string;

  /** Full path from repository root */
  path: string;

  /** Type of entry */
  type: 'file' | 'dir';

  /** File size in bytes (0 for directories) */
  size: number;

  /** Download URL for files */
  downloadUrl: string | null;
}
```

### SyncRequest

Represents a request to perform a sync operation.

**Location**: `@blog/renderer/src/services/sync-orchestrator.ts`

```typescript
/**
 * Request to perform a sync operation.
 */
interface SyncRequest {
  /** Type of sync operation */
  type: 'incremental' | 'full';

  /** Repository information */
  repository: {
    owner: string;
    name: string;
    ref: string;  // Branch or commit SHA
  };

  /** For incremental: files changed in this push */
  changes?: {
    added: string[];
    modified: string[];
    removed: string[];
  };

  /** Force re-render even if content unchanged (for full syncs) */
  force?: boolean;
}
```

**Validation Rules**:
- `type` must be 'incremental' or 'full'
- `repository.owner` and `repository.name` must be non-empty strings
- `repository.ref` must be non-empty (e.g., "main", "refs/heads/main", or SHA)
- For `type: 'incremental'`, `changes` is required
- For `type: 'full'`, `changes` is optional (ignored)

### SyncResult

Represents the result of a sync operation.

**Location**: `@blog/renderer/src/services/sync-orchestrator.ts`

```typescript
/**
 * Result of a completed sync operation.
 */
interface SyncResult {
  /** Sync operation ID */
  syncId: string;

  /** Overall success status */
  success: boolean;

  /** Articles successfully rendered */
  articlesRendered: string[];

  /** Articles that failed rendering */
  articlesFailed: Array<{
    slug: string;
    error: string;
  }>;

  /** Articles deleted */
  articlesDeleted: string[];

  /** Tag pages regenerated */
  tagPagesGenerated: number;

  /** CloudFront invalidation status */
  cacheInvalidated: boolean;

  /** Duration in milliseconds */
  durationMs: number;
}
```

### RenderNotification

Structured notification message for SNS.

**Location**: `@blog/renderer/src/services/sync-orchestrator.ts`

```typescript
/**
 * Notification sent after sync completion.
 * Uses existing NotificationMessage from @blog/core.
 */
type RenderNotification = {
  subject: string;
  body: string;
  severity: 'info' | 'warning' | 'error';
  metadata: {
    syncId: string;
    articlesProcessed: number;
    articlesFailed: number;
    articlesDeleted: number;
    durationMs: number;
  };
};
```

---

## Entity Relationships

```
                          ┌─────────────────┐
                          │   SyncRequest   │
                          │ (incremental or │
                          │     full)       │
                          └────────┬────────┘
                                   │
                                   ▼
┌─────────────┐           ┌─────────────────┐           ┌─────────────┐
│  GitHubFile │◄──────────│ SyncOrchestrator│──────────►│  SyncResult │
│  (fetched)  │           │   (process)     │           │  (output)   │
└─────────────┘           └────────┬────────┘           └─────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
             ┌──────────┐   ┌──────────┐   ┌─────────────┐
             │ Article  │   │ SyncStatus│   │  RenderNoti │
             │ (render) │   │  (track)  │   │  fication   │
             └──────────┘   └──────────┘   └─────────────┘
```

---

## State Transitions

### SyncStatus State Machine

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ startSync()
                           ▼
                    ┌─────────────┐
                    │ in_progress │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            │
       ┌──────────┐  ┌──────────┐      │
       │ completed│  │  failed  │◄─────┘
       └──────────┘  └──────────┘   (error)
```

**Transitions**:
- `pending` → `in_progress`: When sync processing begins
- `in_progress` → `completed`: All articles processed successfully (or with warnings)
- `in_progress` → `failed`: Critical error or all articles failed

---

## Storage Layout

### S3 Object Structure

```
blog-content-{env}-{account}/
├── articles/
│   ├── {slug}/
│   │   ├── index.html      # Rendered article
│   │   ├── hero.jpg        # Co-located assets
│   │   └── diagram.png
│   └── ...
├── tags/
│   ├── index.html          # All tags page
│   ├── typescript.html     # Individual tag pages
│   └── ...
├── pages/
│   ├── index.html          # Home page
│   ├── archive.html        # Archive page
│   └── 404.html            # Error page
└── assets/
    └── styles/
        └── main.css        # Shared styles
```

### GitHub Repository Structure (Source)

```
{owner}/{repo}/
├── posts/
│   ├── {slug}/
│   │   ├── index.md        # Article source
│   │   ├── hero.jpg        # Co-located assets
│   │   └── diagram.png
│   └── ...
└── ...
```

---

## Indexes and Queries

### Required Lookups

1. **Article by slug**: `articles/${slug}/index.html` - Direct S3 key lookup
2. **All articles**: `storage.list('articles/')` - Prefix scan
3. **Tag articles**: In-memory filter from all articles (no separate index)
4. **Sync by ID**: `syncTracker.getSync(syncId)` - In-memory map lookup
5. **Recent syncs**: `syncTracker.getRecentSyncs(limit)` - In-memory sorted list

### Performance Considerations

- Full render of 500 articles: ~5-10 minutes (sequential, could parallelize)
- Incremental render of 1-5 articles: <30 seconds
- Tag page regeneration: <10 seconds for ~10 tags
- CloudFront invalidation: Async, typically 1-2 minutes

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `S3_BUCKET` | Yes | Target bucket for rendered content |
| `CLOUDFRONT_DISTRIBUTION_ID` | Yes | CDN distribution ID for invalidation |
| `GITHUB_WEBHOOK_SECRET` | Yes | Shared secret for signature validation |
| `SNS_TOPIC_ARN` | Yes | SNS topic for notifications |
| `GITHUB_REPOSITORY` | No* | Default repository (owner/repo) for admin ops |
| `NODE_ENV` | Yes | Environment name (dev/staging/prod) |

*Required only if admin full-render needs a default repository.
