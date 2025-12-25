# Feature Specification: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Created**: 2025-12-25
**Status**: Draft
**Input**: Investigation report documenting broken individual tag pages - dev server route doesn't strip `.html` extension and production renderer missing tag page generation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Articles by Tag in Dev Server (Priority: P1)

A reader browsing the blog wants to see all articles tagged with a specific topic. They click on a tag link from either the all-tags page or from an individual article page, and expect to see a page listing all articles with that tag.

**Why this priority**: This is the core user journey - readers discovering content by topic. Without working tag pages, the tagging feature provides no value. Dev server fix enables local development and testing.

**Independent Test**: Can be tested by starting the dev server, navigating to `/tags/`, clicking any tag link, and verifying the tag page loads with the correct articles listed.

**Acceptance Scenarios**:

1. **Given** a reader is on the all-tags page (`/tags/`), **When** they click on a tag link (e.g., "Getting Started"), **Then** they are taken to `/tags/getting-started.html` displaying a list of articles with that tag
2. **Given** a reader is on an article page that has tags, **When** they click on a tag link in the article metadata, **Then** they are taken to the corresponding tag page showing all articles with that tag
3. **Given** a reader navigates directly to `/tags/typescript.html`, **When** the page loads, **Then** they see a page titled "typescript" with a count of articles and a list of those articles

---

### User Story 2 - View Articles by Tag in Production Build (Priority: P1)

A reader on the deployed production site wants to browse articles by tag. When they click tag links, the corresponding static HTML pages should exist and load correctly.

**Why this priority**: Production deployment is equally critical as dev server - without production support, the feature cannot be shipped to users.

**Independent Test**: Can be tested by running a production build, checking that `tags/{slug}.html` files exist in the output directory, and verifying the HTML content is correct.

**Acceptance Scenarios**:

1. **Given** the production build has completed, **When** checking the output directory, **Then** a static HTML file exists for each unique tag (e.g., `tags/typescript.html`, `tags/getting-started.html`)
2. **Given** a production site is deployed, **When** a reader clicks a tag link on any page, **Then** they are taken to the corresponding tag page (no 404 error)
3. **Given** a reader directly navigates to a tag page URL, **When** the page loads, **Then** they see the tag name, article count, and list of articles with that tag

---

### User Story 3 - Tag Page Content Display (Priority: P2)

A reader viewing a tag page wants to see useful information about the tag and easily navigate to articles of interest.

**Why this priority**: Once pages load (P1), the content quality determines usefulness. Secondary to basic functionality.

**Independent Test**: Can be tested by viewing any tag page and verifying all expected content elements are present and correctly populated.

**Acceptance Scenarios**:

1. **Given** a reader is on a tag page, **When** viewing the page content, **Then** they see the tag name as a heading, the number of articles with this tag, and a list of article titles
2. **Given** a tag page displays articles, **When** the reader clicks an article title, **Then** they are navigated to that article's page

---

### Edge Cases

- What happens when a tag slug contains special characters (e.g., "C++")?
  - System should handle URL-encoded slugs correctly by decoding them before matching
- How does the system handle requests for non-existent tags?
  - System should return the generic site 404 page (no custom "tag not found" message)
- What happens when a tag has no articles (orphaned tag)?
  - Tag should not appear in the all-tags page; direct navigation returns 404
- How does case sensitivity work for tag URLs?
  - Tag URL matching is case-insensitive (e.g., `/tags/TypeScript.html` and `/tags/typescript.html` resolve to the same content)
  - The rendered page displays the canonical tag name from TagIndex (preserving original author casing, e.g., "TypeScript" not "typescript")

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve individual tag pages at the URL pattern `/tags/{slug}.html` in the development server
- **FR-002**: System MUST strip the `.html` extension from tag URL parameters before matching against known tags
- **FR-003**: System MUST generate static HTML files for each unique tag during production builds
- **FR-004**: System MUST display the tag name, article count, and list of articles on each tag page
- **FR-005**: System MUST match tag URLs case-insensitively
- **FR-006**: System MUST return a 404 response for tag URLs that don't match any existing tag
- **FR-007**: System MUST render tag pages using the existing `tag.html` template with appropriate context data
- **FR-008**: System MUST ensure all links to tag pages from other pages (all-tags page, article pages) resolve correctly

### Key Entities

- **Tag**: A label applied to articles for categorization. Has a display name (e.g., "Getting Started") and a URL-safe slug (e.g., "getting-started")
- **Tag Page**: A rendered page showing all articles with a specific tag. Contains tag name, article count, and article list
- **Article**: A blog post that can have zero or more tags associated with it

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tag links on the all-tags page successfully navigate to individual tag pages (0% broken link rate)
- **SC-002**: 100% of tag links on article pages successfully navigate to individual tag pages (0% broken link rate)
- **SC-003**: All existing E2E tests for tag navigation pass in both dev server and production build contexts
- **SC-004**: Production build generates one HTML file per unique tag in the `tags/` output directory
- **SC-005**: Tag pages load and display content correctly on first request (no JavaScript-dependent rendering required)

## Out of Scope

- Pagination for tag pages with many articles
- Tag filtering or search functionality on the all-tags page
- Sorting options for articles within tag pages
- Tag management or editing capabilities
- Any UI/UX enhancements beyond fixing broken functionality

## Clarifications

### Session 2025-12-25

- Q: Are there any related tag enhancements explicitly OUT of scope for this fix? → A: Fix only - no enhancements (pagination, filtering, sorting excluded)
- Q: What should the 404 page display for non-existent tags? → A: Generic site 404 page (consistent with other missing pages)

## Assumptions

- The existing `tag.html` template is correctly structured and requires no modifications
- The `renderTagPage()` function in the dev server's renderer module works correctly when provided valid input
- The tag index and article data are already available from existing systems (TagIndex in @blog/core)
- URL slugs are generated consistently across the system using the same slug generation logic
- The dev server state management (`state.tagPages` Map) is functional
