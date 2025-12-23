# Feature Specification: Lightweight Markdown Blog

**Feature Branch**: `001-markdown-blog`
**Created**: 2025-12-23
**Status**: Draft
**Input**: User description: "I want to build a super lightweight blog where essentially all the articles are just markdown files that I throw into some folder and then those get auto-published. One thing I want is automatic tag linking so the markdown files will have some front matter that describes tags, categories, the date that I wrote it, and all of that should get linked up. Then users should be able to navigate and filter around the site using those tags, categories. Also cross-linking should automatically work"

## Clarifications

### Session 2025-12-23

- Q: What is the deployment architecture (server-rendered, SSG, or hybrid)? → A: Hybrid AWS-hosted service that pulls posts from Git, pre-renders markdown to HTML on Git push, caches rendered content, and serves from cache. Content changes trigger re-render automatically; code changes require redeploy.
- Q: Should categories and tags be separate taxonomies or merged? → A: Merge into tags only. Single flat taxonomy for all article labeling; no separate category system.
- Q: What syntax for cross-links between articles? → A: Obsidian-style `[[Title or Alias]]` for internal links (case-insensitive, normalized matching, front matter alias support); standard markdown `[text](url)` for external links.
- Q: Where do images live relative to posts? → A: Co-located per post. Each post is a folder containing `index.md` plus any images/assets. Structure: `posts/my-article/index.md`, `posts/my-article/image.png`. Reference with `![](./image.png)`.
- Q: What is the expected traffic scale for performance planning? → A: Scale-to-zero with burst capability. Start minimal (near-zero to 100-1,000 daily visitors), scale down to zero when idle to minimize costs, but architecture must handle sudden traffic spikes without re-engineering.
- Q: How should the system handle Git sync or render failures? → A: Dashboard + SNS alerting. Retry failed syncs, show status in admin dashboard, send AWS SNS/email notification after persistent failures. Use AWS free tier for cost-effectiveness.
- Q: How should the admin dashboard be protected? → A: AWS IAM authorization via API Gateway. Architect for portability: abstract AWS-specific integrations (S3, SNS, Lambda, IAM) behind interfaces so core logic remains cloud-agnostic and could be re-hosted without rewriting business logic.
- Q: What level of accessibility compliance should the blog meet? → A: WCAG 2.1 AA. Semantic HTML, keyboard navigation, sufficient color contrast, screen reader support.
- Q: What is the target page load time for rendered blog pages? → A: Under 2 seconds (standard UX threshold). Future optimization may improve this; initial implementation targets this baseline.
- Q: What level of observability is needed for initial release? → A: Basic CloudWatch logging with error alerting. Start minimal; add detailed metrics/tracing as operational needs emerge.
- Q: How should article uniqueness be determined? → A: Folder name is the canonical slug. URL path derived from folder name; filesystem enforces uniqueness.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write and Publish an Article (Priority: P1)

As a blog author, I want to create a new markdown file with front matter in a designated folder, and have it automatically appear on my blog without any manual build steps or configuration.

**Why this priority**: This is the core functionality - without the ability to publish articles by simply adding markdown files, the blog has no purpose. This delivers immediate value and validates the fundamental concept.

**Independent Test**: Can be fully tested by creating a post folder with `index.md` containing front matter (title, date, tags) in the posts directory and verifying it appears on the blog with correct formatting.

**Acceptance Scenarios**:

1. **Given** an empty posts directory, **When** I add a post folder containing `index.md` with valid front matter (title, date, tags), **Then** the article appears on the blog homepage with its title, date, and excerpt
2. **Given** a post folder with `index.md`, **When** changes are pushed to Git, **Then** the article is available without manual rebuild
3. **Given** a post with standard markdown formatting (headers, lists, code blocks, links, images), **When** the article is rendered, **Then** all formatting displays correctly
4. **Given** a post folder containing `index.md` and image files, **When** the markdown references images with relative paths (`![](./image.png)`), **Then** images display correctly

---

### User Story 2 - Browse Articles by Tag (Priority: P2)

As a blog reader, I want to click on a tag attached to any article and see all other articles that share that tag, so I can discover related content.

**Why this priority**: Tag-based navigation is a core requested feature and enables content discovery. This builds directly on P1's tagging infrastructure.

**Independent Test**: Can be tested by creating 3+ articles with overlapping tags, clicking a tag, and verifying the filtered list shows only articles with that tag.

**Acceptance Scenarios**:

1. **Given** multiple articles with the tag "javascript", **When** I click the "javascript" tag on any article, **Then** I see a list of all articles tagged with "javascript"
2. **Given** an article with multiple tags, **When** the article is displayed, **Then** all tags are shown as clickable links
3. **Given** a tag page, **When** I view it, **Then** I see the tag name and count of articles

---

### User Story 3 - Navigate via Cross-Links (Priority: P3)

As a blog reader, I want links between articles to work automatically when authors reference other posts, so I can easily navigate between related content.

**Why this priority**: Cross-linking enhances content interconnection but requires P1's article system to function. It's an enhancement to the core publishing feature.

**Independent Test**: Can be tested by creating two articles where one references the other using Obsidian-style `[[Title]]` syntax, and verifying the link navigates correctly.

**Acceptance Scenarios**:

1. **Given** Article A contains `[[Article B Title]]`, **When** I click the rendered link, **Then** I navigate to Article B
2. **Given** Article A contains `[[Non Existent]]` referencing no article, **When** the article is rendered, **Then** the link is displayed as plain text or marked as broken
3. **Given** an article with `[[title]]` where casing or spacing differs from actual title, **When** rendered, **Then** the link still resolves (case-insensitive, normalized matching)
4. **Given** an article with a front matter `aliases: ["shortname"]`, **When** another article links via `[[shortname]]`, **Then** the link resolves to that article

---

### User Story 4 - Browse Articles by Date (Priority: P3)

As a blog reader, I want to see articles organized chronologically and filter by time periods, so I can find recent content or explore archives.

**Why this priority**: Date-based navigation provides temporal organization. Lower priority than tags since those were explicitly emphasized by the user.

**Independent Test**: Can be tested by creating articles with different dates and verifying they appear in chronological order on the homepage and archives.

**Acceptance Scenarios**:

1. **Given** the blog homepage, **When** I view the article list, **Then** articles are sorted by date (newest first)
2. **Given** articles spanning multiple months, **When** I view the archives, **Then** I can navigate to articles by month/year
3. **Given** an article's front matter contains a date, **When** the article is displayed, **Then** the date is shown in a human-readable format

---

### Edge Cases

- What happens when a markdown file has missing or malformed front matter? (System should display a helpful error or skip the file with a warning)
- How does the system handle duplicate slugs/filenames? (System should detect and warn about duplicates)
- What happens when a referenced cross-link article is deleted? (Link should be marked as broken or converted to plain text)
- How are drafts handled? (Articles with `draft: true` in front matter should not be published)
- What happens with deeply nested folder structures in the articles directory? (System should handle subdirectories or explicitly document flat-only structure)
- How are special characters in tags handled? (Spaces, punctuation should be normalized to URL-safe slugs)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically detect and publish posts (folders containing `index.md`) placed in the designated posts directory
- **FR-002**: System MUST parse YAML front matter from markdown files containing at minimum: title, date, and tags
- **FR-003**: System MUST render markdown content to properly formatted HTML, supporting standard markdown syntax (headers, lists, code blocks, links, images, blockquotes)
- **FR-004**: System MUST generate tag pages that list all articles associated with each tag
- **FR-005**: System MUST resolve Obsidian-style `[[Title]]` cross-links between articles using case-insensitive, normalized matching (spaces ≈ dashes ≈ underscores) and front matter aliases
- **FR-006**: System MUST display articles in reverse chronological order on the homepage
- **FR-007**: System MUST derive article slugs from folder names (folder name is canonical; filesystem enforces uniqueness)
- **FR-008**: System MUST support draft articles that are excluded from publication when `draft: true` is set in front matter
- **FR-009**: System MUST display tags as clickable navigation elements on article pages
- **FR-010**: System MUST provide a way to view all tags (tag cloud or list)
- **FR-011**: System MUST handle gracefully markdown files with missing or invalid front matter by logging warnings and excluding them from publication
- **FR-012**: System MUST serve images and assets co-located in post folders, resolving relative paths in markdown
- **FR-013**: System MUST automatically retry failed Git syncs/renders and display sync status in an admin dashboard
- **FR-014**: System MUST send AWS SNS/email alerts after persistent sync/render failures (3+ consecutive failures)

### Key Entities

- **Article**: A blog post created from a markdown file. Contains title, date, content, tags (list), slug (derived from folder name), and draft status. Relates to multiple Tags.
- **Tag**: A label for grouping related articles. Has a name, slug, and relates to multiple Articles. Used for all article classification (both broad and specific topics).
- **Front Matter**: YAML metadata at the top of markdown files defining article properties (title, date, tags, draft, aliases). Aliases are optional alternate titles for cross-link resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authors can publish a new article by adding a markdown file in under 1 minute (no manual build or configuration required)
- **SC-002**: Readers can navigate from any article to all related articles (by tag) within 2 clicks
- **SC-003**: 100% of valid markdown files with proper front matter are automatically published
- **SC-004**: All cross-links between articles resolve correctly when the target article exists
- **SC-005**: The blog displays correctly and is navigable on mobile and desktop browsers
- **SC-006**: New visitors can find articles by tag or date within 30 seconds of arriving
- **SC-007**: Blog UI meets WCAG 2.1 AA accessibility standards (keyboard navigable, screen reader compatible, sufficient color contrast)
- **SC-008**: Blog pages load in under 2 seconds for visitors (measured as Time to First Contentful Paint)

## Assumptions

- The blog runs as an AWS-hosted service that monitors a Git repository for changes; when markdown files in the posts folder change, the service automatically pre-renders them to HTML and caches the result; no manual rebuild is required for content changes
- Posts directory location follows a convention (e.g., `/posts`); each post is a folder containing `index.md` and any co-located images/assets
- Tags are simple strings with no hierarchical structure; a single flat taxonomy handles all article classification
- Date format in front matter follows ISO 8601 (YYYY-MM-DD) or similar standard format
- The blog supports a single author (no multi-author attribution required)
- Search functionality is not included in the initial scope
- Pagination for long article lists follows reasonable defaults (10-20 articles per page)
- Infrastructure must scale to zero when idle (minimize costs for low-traffic periods) while supporting sudden traffic spikes without architectural changes
- Architecture must minimize cloud vendor lock-in: abstract AWS-specific services (S3, SNS, Lambda, IAM) behind interfaces so core business logic remains portable
- Admin dashboard protected via AWS IAM/API Gateway authorization
- Observability starts with basic CloudWatch logging and error alerting; detailed metrics, request tracing, and dashboards deferred until operational needs clarify priorities
