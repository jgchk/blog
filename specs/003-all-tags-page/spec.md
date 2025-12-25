# Feature Specification: All Tags Page

**Feature Branch**: `003-all-tags-page`
**Created**: 2025-12-25
**Status**: Draft
**Input**: User description: "Implement All Tags page (tag index) for dev-server and production renderer - missing feature per FR-010"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse All Tags (Priority: P1)

As a blog reader, I want to see a page listing all tags used across the blog so I can discover topics and find articles by interest area.

**Why this priority**: Core feature requirement (FR-010 from spec 001-markdown-blog). Without this, users have no way to discover all available tags and must rely on stumbling across tags on individual articles.

**Independent Test**: Can be fully tested by navigating to `/tags/` and verifying the page displays all tags with article counts. Delivers immediate value for content discovery.

**Acceptance Scenarios**:

1. **Given** I am on any page of the blog, **When** I navigate to `/tags/`, **Then** I see a page listing all tags used in the blog with the count of articles for each tag
2. **Given** the blog has articles tagged with "TypeScript", "React", and "Testing", **When** I view the all tags page, **Then** I see all three tags listed with their respective article counts
3. **Given** I am viewing the all tags page, **When** I click on a tag (e.g., "TypeScript"), **Then** I am navigated to that tag's dedicated page (`/tags/typescript.html`) showing articles with that tag

---

### User Story 2 - Navigate to Tags Page from Site Navigation (Priority: P2)

As a blog reader, I want to access the tags page from the site navigation so I can easily find it without remembering the URL.

**Why this priority**: Improves discoverability of the tags page. Without navigation link, users must know the URL exists.

**Independent Test**: Can be tested by verifying navigation contains a link to `/tags/` and clicking it navigates correctly.

**Acceptance Scenarios**:

1. **Given** I am on any page of the blog, **When** I view the site navigation, **Then** I see a link to the tags page
2. **Given** I click the tags link in navigation, **When** the page loads, **Then** I am on the `/tags/` page showing all tags

---

### User Story 3 - Tags Page in Production Build (Priority: P1)

As a blog publisher, I want the all tags page to be generated during production builds so visitors to the deployed site can browse tags.

**Why this priority**: Equal to P1 since the feature must work in both development and production environments. A development-only feature would not meet the requirement.

**Independent Test**: Can be tested by running the production renderer and verifying `/tags/index.html` is generated with correct content.

**Acceptance Scenarios**:

1. **Given** I run the production renderer, **When** generation completes, **Then** a `/tags/index.html` file is created in the output directory
2. **Given** the production site is deployed, **When** a visitor navigates to `/tags/`, **Then** they see the all tags page with all tags and counts

---

### Edge Cases

- What happens when no articles have any tags? The page should display gracefully with a message like "No tags found" or show an empty list
- What happens when a tag has zero articles (orphaned tag)? Only tags with at least one article should be displayed
- How does the page handle special characters in tag names? Tags should be URL-encoded properly for links

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve an all tags page at the `/tags/` URL path in the dev-server
- **FR-002**: System MUST generate `/tags/index.html` during production builds
- **FR-003**: The all tags page MUST display each tag as a clickable link to that tag's individual page
- **FR-004**: The all tags page MUST display the count of articles for each tag
- **FR-005**: The all tags page MUST display the total number of unique tags on the blog
- **FR-006**: Tags MUST be sorted alphabetically for consistent display
- **FR-007**: The all tags page MUST use the existing site template system for consistent styling
- **FR-008**: The dev-server MUST update the all tags page when articles are added, modified, or removed (live reload)
- **FR-009**: Site navigation MUST include a link to the all tags page

### Key Entities

- **Tag**: A label applied to articles for categorization (string identifier, associated article count)
- **Tag Index**: Collection of all tags with their metadata (tag name, article count, URL to tag page)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate to `/tags/` and see all tags within 1 second page load time
- **SC-002**: 100% of tags present in articles are displayed on the all tags page
- **SC-003**: All tag links correctly navigate to the corresponding tag page
- **SC-004**: The page displays correctly in the dev-server and matches the production-generated version
- **SC-005**: E2E tests in `packages/site/tests/e2e/all-tags.spec.ts` pass successfully

## Assumptions

- The existing `tag-list.html` template in `packages/site/src/templates/partials/` provides the base HTML structure and can be moved/adapted for this feature
- The existing `TagIndex` service and `getAllTags()` helper provide the necessary data access
- The existing E2E test file defines the expected behavior and serves as the acceptance test
- Tag pages (`/tags/:tag.html`) already work correctly - this feature only adds the index/listing page
