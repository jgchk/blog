# Feature Specification: Webhook Renderer Connection

**Feature Branch**: `006-webhook-renderer-connection`
**Created**: 2025-12-26
**Status**: Draft
**Input**: User description: "Connect GitHub webhook to actually trigger rendering when posts are pushed to main branch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic Post Publishing (Priority: P1)

As a blog author, I want my posts to be automatically rendered and published when I push changes to the main branch, so that I don't have to manually trigger rendering after each update.

**Why this priority**: This is the core functionality that completes the publishing pipeline. Without it, the entire webhook infrastructure serves no purpose.

**Independent Test**: Can be fully tested by pushing a new or modified post to the `posts/` directory on main branch and verifying the rendered content appears on the live site within a reasonable time.

**Acceptance Scenarios**:

1. **Given** a webhook is configured and the blog is deployed, **When** I push a new markdown post to `posts/my-new-post/index.md`, **Then** the post is rendered and available on the public blog.
2. **Given** an existing published post, **When** I push an update to that post's markdown file, **Then** the updated content replaces the old version on the public blog.
3. **Given** a post with co-located images in its directory, **When** I push the post to main, **Then** both the rendered HTML and the images are available on the public blog.

---

### User Story 2 - Full Site Render on Demand (Priority: P2)

As a blog administrator, I want to trigger a full render of all posts when needed (initial deployment, template changes, recovery), so that I can ensure the entire site is consistent and up-to-date.

**Why this priority**: Critical for operational scenarios but not needed for day-to-day publishing. Initial deployment and disaster recovery depend on this capability.

**Independent Test**: Can be fully tested by calling an administrative endpoint and verifying all posts are re-rendered.

**Acceptance Scenarios**:

1. **Given** a deployed blog with existing posts in the repository, **When** I trigger a full render, **Then** all posts are rendered and published to the live site.
2. **Given** templates have been updated, **When** I trigger a full render, **Then** all posts reflect the new template styling.
3. **Given** the blog storage is empty or corrupted, **When** I trigger a full render, **Then** all content is restored from the source repository.

---

### User Story 3 - Post Deletion Handling (Priority: P3)

As a blog author, I want deleted posts to be removed from the public blog when I delete them from the repository, so that outdated or retracted content is no longer accessible.

**Why this priority**: Important for content lifecycle management but less frequent than publishing new or updated content.

**Independent Test**: Can be fully tested by deleting a post directory from the repository and verifying it no longer appears on the public blog.

**Acceptance Scenarios**:

1. **Given** a published post exists on the blog, **When** I delete the post's directory from the `posts/` folder and push to main, **Then** the post is removed from the public blog.
2. **Given** a deleted post had associated assets, **When** the post is deleted, **Then** the assets are also removed from the public storage.

---

### User Story 4 - Rendering Status Visibility (Priority: P3)

As a blog administrator, I want to know when rendering completes or fails, so that I can verify my changes are live or troubleshoot issues.

**Why this priority**: Operational visibility is valuable but the system should work without it.

**Independent Test**: Can be fully tested by triggering a render operation and verifying a notification is received.

**Acceptance Scenarios**:

1. **Given** a push triggers rendering, **When** rendering completes successfully, **Then** I receive a notification indicating success with a summary of what was rendered.
2. **Given** a push triggers rendering, **When** rendering fails, **Then** I receive a notification indicating failure with error details.

---

### Edge Cases

- What happens when a pushed file is not valid markdown? The system logs an error for that file but continues processing other files.
- What happens when the repository is inaccessible during rendering? The operation fails gracefully with an error notification.
- What happens when a push contains changes to non-post files (e.g., templates, config)? Only files in the `posts/` directory trigger rendering; other changes are ignored by the incremental webhook handler.
- What happens when multiple pushes occur in rapid succession? Each push is processed independently. For different posts, operations run concurrently without interference. For the same post, S3's last-write-wins semantics apply—the final push's content becomes authoritative. No application-level locking is required.
- What happens when co-located assets have very large file sizes? Individual files up to 10MB are handled; larger files are skipped with a warning logged. Posts with cumulative assets exceeding 50MB are processed but may approach Lambda memory limits; a warning is logged when total exceeds 25MB.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render and publish posts when changes to the `posts/` directory are pushed to the main branch.
- **FR-002**: System MUST fetch post content (markdown and assets) from the source repository when triggered by a webhook.
- **FR-003**: System MUST support incremental rendering (only changed posts) for webhook-triggered operations.
- **FR-004**: System MUST support full rendering (all posts) via an administrative operation.
- **FR-005**: System MUST handle post deletions by removing the corresponding content from public storage.
- **FR-006**: System MUST copy co-located assets (images, files in post directories) alongside rendered posts.
- **FR-007**: System MUST validate webhook requests to ensure they originate from the configured source.
- **FR-008**: System MUST send notifications on render completion or failure.
- **FR-009**: System MUST track sync operations for observability and debugging.
- **FR-010**: System MUST handle rendering operations that exceed the initial request timeout by processing asynchronously.
- **FR-011**: System MUST regenerate tag index pages on every render operation (both incremental and full renders) to ensure tag navigation remains consistent with published content.
- **FR-012**: Administrative endpoints (including full render) MUST require IAM authentication, consistent with existing admin endpoint patterns.

### Key Entities

- **Post**: A markdown file with front matter metadata, located in `posts/{slug}/index.md`, representing a single blog article.
- **Post Assets**: Images and other files co-located with a post in its directory (e.g., `posts/{slug}/hero.jpg`).
- **Sync Operation**: A tracked rendering job with a unique identifier, start time, status, and list of affected files. Sync operations are tracked in-memory for the duration of the Lambda invocation and logged to CloudWatch for post-hoc analysis. No persistent storage of sync state is required.
- **Webhook Event**: An incoming notification from the source code platform indicating changes have been pushed.
- **Render Notification**: A message sent after rendering completes or fails, containing:
  - `type`: "success" | "failure"
  - `syncId`: Unique identifier for the sync operation
  - `timestamp`: ISO 8601 completion time
  - `summary`: Object with `postsRendered`, `postsDeleted`, `assetsCopied` counts (success) or `error` message (failure)
  - `duration`: Milliseconds elapsed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New posts are visible on the public blog within 60 seconds of pushing to main branch under normal operating conditions (single post, assets under 5MB total).
- **SC-002**: 100% of webhook-triggered operations complete without manual intervention during normal operation.
- **SC-003**: Full site render completes all posts without timeout for blogs with up to 500 posts (target: under 10 minutes with Lambda 15-minute limit as hard ceiling).
- **SC-004**: Administrators receive render status notifications within 30 seconds of operation completion.
- **SC-005**: Zero posts are lost or corrupted when multiple pushes occur within a 10-second window. Each push is processed independently; operations on different posts may run concurrently, while operations on the same post are serialized by S3's eventual consistency model.
- **SC-006**: Post deletions are reflected on the public site within 60 seconds of push.
- **SC-007**: Render operation timing is logged to CloudWatch, enabling verification of 60-second latency target.

**SC-001 Verification Note**: The 60-second latency target (SC-001) is verified through CloudWatch log analysis using timing data from SC-007, not through automated tests. This avoids flaky timing-dependent tests while providing production observability.

## Clarifications

### Session 2025-12-26

- Q: Is the repository public or private? → A: Public repository (no authentication needed to fetch)
- Q: How should the admin render endpoint be protected? → A: IAM authentication (consistent with existing admin endpoints)

## Assumptions

- The source repository is a public GitHub repository (no authentication required to fetch content).
- Posts follow the convention `posts/{slug}/index.md` with optional co-located assets.
- The rendering service has network access to fetch content from the repository.
- The SNS topic for notifications is already provisioned in the CDK stack (created by feature 005-ci-cd-pipeline); this feature adds message formatting and publishing logic. The topic ARN is provided via the `NOTIFICATION_TOPIC_ARN` environment variable. See `packages/infra/lib/blog-stack.ts` for the existing topic definition.
- Co-located asset files are limited to reasonable sizes (under 10MB each) for practical transfer times.
- The webhook secret is properly configured for request validation.
- Tag pages functionality already exists and can be invoked as part of the rendering process.
