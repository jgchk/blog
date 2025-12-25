# Data Model: All Tags Page

**Feature**: 003-all-tags-page
**Date**: 2025-12-25

## Overview

This feature uses existing data models from `@blog/core`. No new entities required.

## Existing Entities (No Changes)

### Tag (from @blog/core)

**Location**: `packages/core/src/models/tag.ts`

```typescript
interface Tag {
  slug: string;       // URL-safe identifier (lowercase, hyphenated)
  name: string;       // Display name (original casing from first occurrence)
  count: number;      // Number of articles with this tag
  articles: string[]; // Array of article slugs
}
```

**Validation Rules**:
- `slug`: Non-empty, lowercase, alphanumeric with hyphens
- `name`: Non-empty string
- `count`: Non-negative integer, equals `articles.length`
- `articles`: Array of valid article slugs

---

### TagIndex (from @blog/core)

**Location**: `packages/core/src/services/tag-index.ts`

```typescript
class TagIndex {
  // Build from articles
  static buildFromArticles(articles: Article[]): TagIndex;

  // Accessors
  get tags(): Tag[];              // All tags (unsorted)
  get totalTags(): number;        // Count of unique tags
  getAllTags(): Tag[];            // Tags sorted by count (descending)
  getTagBySlug(slug: string): Tag | undefined;

  // Serialization
  toJSON(): TagIndexJSON;
}

interface TagIndexJSON {
  tags: Tag[];
  totalTags: number;
}
```

---

### RenderedArticle (from dev-server)

**Location**: `packages/dev-server/src/types.ts`

Used to extract tags for building TagIndex. Key fields:

```typescript
interface RenderedArticle {
  slug: string;
  metadata: {
    title: string;
    date: Date;
    tags: string[];    // Tag names for this article
    excerpt: string;
  };
  html: string;
  error?: RenderError;
}
```

---

## New State Property

### DevServerState.allTagsHtml

**Location**: `packages/dev-server/src/state.ts`

```typescript
class DevServerState {
  // Existing properties
  indexHtml: string;
  archiveHtml: string;
  tagPages: Map<string, string>;

  // NEW: Add this property
  allTagsHtml: string = '';  // Cached rendered all-tags page
}
```

**Lifecycle**:
- Initialized: Empty string on server start
- Populated: On first request to `/tags/` route
- Invalidated: Set to empty string when any article changes
- Cleared: On `reset()` call

---

## Template Data Contract

### AllTagsTemplateData

Data passed to `tags.html` Handlebars template:

```typescript
interface AllTagsTemplateData {
  totalTags: number;        // e.g., 15
  tags: TagDisplayItem[];   // Sorted alphabetically by name
  year: number;             // Current year for footer
}

interface TagDisplayItem {
  slug: string;             // URL path segment: "typescript"
  name: string;             // Display name: "TypeScript"
  count: number;            // Article count: 12
}
```

**Sorting**: Tags sorted alphabetically by `name` (case-insensitive) per FR-006.

**Example Data**:
```json
{
  "totalTags": 3,
  "tags": [
    { "slug": "javascript", "name": "JavaScript", "count": 5 },
    { "slug": "react", "name": "React", "count": 3 },
    { "slug": "typescript", "name": "TypeScript", "count": 12 }
  ],
  "year": 2025
}
```

---

## Data Flow

```
┌─────────────────┐
│   Request to    │
│    /tags/       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Check cache:   │ Yes │  Return cached  │
│ state.allTagsHtml ├──►│     HTML        │
│    not empty?   │     └─────────────────┘
└────────┬────────┘
         │ No
         ▼
┌─────────────────┐
│ Get all articles│
│ from state      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Build TagIndex  │
│ from articles   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sort tags       │
│ alphabetically  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Render with     │
│ tags.html       │
│ template        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cache result in │
│ state.allTagsHtml│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return HTML     │
│ with live reload│
│ script injected │
└─────────────────┘
```

---

## Relationships

```
Article (1) ──────< (N) Tag
   │                    │
   │ extracted from     │ aggregated into
   │ front matter       │
   ▼                    ▼
RenderedArticle      TagIndex
   │                    │
   │                    │ provides data to
   │                    ▼
   │              AllTagsTemplateData
   │                    │
   │                    │ rendered with
   │                    ▼
   │               tags.html template
   │                    │
   └────────────────────┘
           │
           ▼
      allTagsHtml (cached)
```

---

## Edge Cases

| Scenario | Behavior | Template Output |
|----------|----------|-----------------|
| No articles | `totalTags: 0`, empty `tags` array | "No tags yet. Check back after articles are published." |
| All articles are drafts | Same as no articles | Same message |
| Single tag | `totalTags: 1`, one item in array | Single tag displayed |
| Tag with zero articles | Never occurs - tags derived from articles | N/A |
| Duplicate tag names (diff case) | Normalized to same slug; first occurrence sets display name | Single entry |
