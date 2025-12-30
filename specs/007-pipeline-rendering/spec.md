# Feature Specification: Pipeline-Based Rendering (Architecture Simplification)

**Feature Branch**: `007-pipeline-rendering`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Simplify architecture by removing GitHub webhooks and rendering everything in the deploy pipeline for the main branch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish Posts via Merge to Main (Priority: P1)

As a blog author, I want my posts to be automatically rendered and published when I merge changes to the main branch, so that publishing is as simple as merging a PR with no additional infrastructure required.

**Why this priority**: This is the core publishing workflow that replaces the webhook-based system. Every blog update flows through this mechanism.

**Independent Test**: Can be fully tested by merging a PR that adds or modifies a post in the `posts/` directory and verifying the rendered content appears on the live site after the CI/CD pipeline completes.

**Acceptance Scenarios**:

1. **Given** the CI/CD pipeline is configured, **When** I merge a PR that adds a new post to `posts/my-new-post/index.md`, **Then** the post is rendered and published to the live blog as part of the deployment.
2. **Given** an existing published post, **When** I merge a PR that updates that post's markdown file, **Then** the updated content replaces the old version on the live blog.
3. **Given** a post with co-located images in its directory, **When** I merge the PR, **Then** both the rendered HTML and the images are deployed and accessible on the live blog.

---

### User Story 2 - Full Site Render on Every Deploy (Priority: P1)

As a blog administrator, I want the entire site to be rendered fresh on every deployment, so that template changes, tag pages, and all posts are always consistent without needing separate render operations.

**Why this priority**: This eliminates the need for a separate "full render" administrative operation and ensures site-wide consistency automatically.

**Independent Test**: Can be fully tested by making a template change and merging to main, then verifying all posts reflect the new template.

**Acceptance Scenarios**:

1. **Given** any merge to main triggers a deployment, **When** the pipeline runs, **Then** all posts in the repository are rendered and deployed.
2. **Given** templates have been updated, **When** the pipeline completes, **Then** all posts reflect the new template styling without manual intervention.
3. **Given** tag metadata has changed across posts, **When** the pipeline completes, **Then** all tag index pages are regenerated with current data.

---

### User Story 3 - Post Removal via Deletion (Priority: P2)

As a blog author, I want deleted posts to be removed from the live blog when I merge a PR that removes them, so that outdated or retracted content is no longer accessible.

**Why this priority**: Important for content lifecycle but less frequent than publishing. The full re-render approach naturally handles this.

**Independent Test**: Can be fully tested by deleting a post directory in a PR, merging, and verifying the post is no longer on the live site.

**Acceptance Scenarios**:

1. **Given** a published post exists on the blog, **When** I merge a PR that deletes the post's directory from `posts/`, **Then** the post is no longer accessible on the live blog.
2. **Given** a deleted post had associated assets, **When** the deployment completes, **Then** the assets are also no longer accessible.

---

### User Story 4 - Deployment Status Visibility (Priority: P3)

As a blog administrator, I want to see deployment progress and results in GitHub Actions, so that I can verify my changes went live or troubleshoot issues.

**Why this priority**: Operational visibility is valuable but the system should work without specialized monitoring.

**Independent Test**: Can be fully tested by triggering a deployment and reviewing the GitHub Actions run log.

**Acceptance Scenarios**:

1. **Given** a merge triggers deployment, **When** I view the GitHub Actions run, **Then** I can see the render step progress and completion status.
2. **Given** rendering fails for any reason, **When** I view the GitHub Actions run, **Then** I can see which post failed and the error details.

---

### Edge Cases

- What happens when a post has invalid markdown syntax? The rendering step fails with a clear error message identifying the problematic file; deployment does not proceed with partial content.
- What happens when the repository contains hundreds of posts? The pipeline renders all posts sequentially or in parallel batches; reasonable timeout limits apply (target under 10 minutes for 500 posts).
- What happens when images or assets are missing from post directories? The pipeline logs a warning but continues rendering; broken image links are visible on the rendered post.
- What happens when two PRs are merged in quick succession? The pipeline uses `cancel-in-progress: true` concurrency—the latest merge cancels any pending deployment, ensuring the most recent content always wins.
- What happens when S3 upload fails mid-deployment? The deployment fails and the site may be in a partially updated state. The next successful deployment will restore full consistency. Assets are uploaded before HTML to minimize broken references during the upload window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render all posts during the CI/CD pipeline deployment step when changes are merged to main.
- **FR-002**: System MUST upload rendered HTML and post assets to the S3 bucket as part of deployment.
- **FR-003**: System MUST regenerate all tag index pages during each deployment.
- **FR-004**: System MUST regenerate the "all tags" page during each deployment.
- **FR-005**: System MUST invalidate CloudFront cache after successful upload to ensure fresh content is served.
- **FR-006**: System MUST remove content from S3 that no longer exists in the repository (sync behavior, not additive-only).
- **FR-007**: System MUST fail the deployment step if any post fails to render, preventing partial site updates.
- **FR-008**: System MUST log render progress and errors visible in GitHub Actions output.
- **FR-009**: System MUST complete rendering within the GitHub Actions job timeout (6 hours max, target under 15 minutes for typical blogs).
- **FR-010**: System MUST support the existing post structure (`posts/{slug}/index.md` with co-located assets).

### Key Entities

- **Post**: A markdown file with front matter metadata, located in `posts/{slug}/index.md`, representing a single blog article.
- **Post Assets**: Images and other files co-located with a post in its directory (e.g., `posts/{slug}/hero.jpg`).
- **Tag Index Page**: An HTML page listing all posts with a specific tag.
- **All Tags Page**: An HTML page listing all tags used across the blog with post counts.
- **Rendered Site**: The complete set of HTML files and assets uploaded to S3, representing the full blog content.
- **Deployment Run**: A single execution of the render-and-deploy step within the CI/CD pipeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: New posts are visible on the live blog within 20 minutes of merging to main branch (aligned with existing CI/CD SC-003 deployment time).
- **SC-002**: 100% of successful deployments result in a consistent site where all posts, tags, and assets are present and functional.
- **SC-003**: Full site render for blogs with up to 500 posts completes within 10 minutes.
- **SC-004**: Deployment failures produce actionable error messages identifying the failing post or step within 60 seconds of failure.
- **SC-005**: Zero orphaned content remains after posts are deleted from the repository and deployment completes.
- **SC-006**: Template changes are reflected across all posts after a single deployment without manual intervention.

## Assumptions

- The source repository is a public GitHub repository (consistent with existing setup).
- Posts follow the convention `posts/{slug}/index.md` with optional co-located assets.
- The existing CI/CD pipeline (005-ci-cd-pipeline) provides the GitHub Actions infrastructure this feature extends.
- The existing S3 bucket and CloudFront distribution from the CDK stack are used for content hosting.
- The existing `@blog/core` rendering logic can be invoked as a build step (not requiring Lambda execution).
- CloudFront cache invalidation is acceptable latency-wise (typically 1-2 minutes after S3 upload).
- Blog size will remain under 500 posts for the foreseeable future.
- The pipeline uses pnpm for package management (consistent with existing setup).

## Clarifications

### Session 2025-12-30

- Q: What concurrency strategy should be used when multiple PRs merge quickly? → A: Cancel-in-progress (latest merge cancels pending deploy)
- Q: How should S3 upload failures be handled to prevent partial site state? → A: Upload to staging prefix, then atomic swap (full consistency)

## Architectural Impact

This feature represents a significant simplification by:

1. **Removing**: GitHub webhook infrastructure, webhook Lambda handler, webhook secret management, incremental rendering logic, async processing patterns, SNS notifications for render status.
2. **Retaining**: S3 bucket, CloudFront distribution, existing rendering logic (adapted to run as build step).
3. **Adding**: Render step in GitHub Actions workflow, S3 sync/upload logic in CI, CloudFront invalidation in CI.

The trade-off is that every deployment renders the entire site, which is acceptable for blogs with hundreds (not thousands) of posts.
