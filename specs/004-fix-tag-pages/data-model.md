# Data Model: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Date**: 2025-12-25

## Overview

This feature uses existing data models with no modifications. Documented here for reference and contract alignment.

## Existing Entities (No Changes Required)

### Tag

**Location**: `packages/core/src/models/tag.ts`

```typescript
interface Tag {
  slug: string;       // URL-safe identifier (e.g., "getting-started")
  name: string;       // Display name with original casing (e.g., "Getting Started")
  count: number;      // Number of articles with this tag
  articles: string[]; // Array of article slugs
}
```

**Validation Rules**:
- `slug`: Non-empty, lowercase, alphanumeric with hyphens only
- `name`: Non-empty string, preserves original author casing
- `count`: Non-negative integer, equals `articles.length`
- `articles`: Array of valid article slugs

**Slug Generation** (`normalizeTagSlug(name: string): string`):
- Converts to lowercase
- Replaces spaces with hyphens
- Replaces special characters (e.g., "C++" → "c-plus-plus")
- Removes leading/trailing hyphens

### Article (Tag-Related Fields Only)

**Location**: `packages/core/src/models/article.ts`

```typescript
interface Article {
  slug: string;           // URL identifier
  title: string;          // Display title
  date: Date;             // Publication date
  tags: string[];         // Array of tag names (not slugs)
  excerpt: string;        // Article summary
  // ... other fields omitted
}
```

### TagIndex

**Location**: `packages/core/src/services/tag-index.ts`

```typescript
class TagIndex {
  static buildFromArticles(articles: Article[]): TagIndex;

  getTagBySlug(slug: string): Tag | undefined;
  getArticlesByTag(tagSlug: string): string[];
  getAllTags(): Tag[];  // Sorted by count descending
  get tags(): Tag[];    // All tags as array

  toJSON(): { tags: Tag[]; totalTags: number };
}
```

## Template Context (Existing)

### Tag Page Template Context

**Template**: `packages/site/src/templates/tag.html`

```typescript
interface TagPageContext {
  tagName: string;        // Display name (e.g., "TypeScript")
  tagSlug: string;        // URL slug (e.g., "typescript")
  articleCount: number;   // Number of articles
  isPlural: boolean;      // true if articleCount !== 1
  articles: Array<{
    slug: string;         // Article URL slug
    title: string;        // Article title
    dateIso: string;      // ISO 8601 date string
    dateFormatted: string; // Human-readable date
    excerpt: string;      // Article excerpt
  }>;
  year: number;           // Current year (for footer)
}
```

## URL Routing

### Request Flow

```
Browser Request: GET /tags/typescript.html
                        │
                        ▼
┌─────────────────────────────────────────┐
│ Route Parameter Extraction              │
│ tag = "typescript.html"                 │
└─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────┐
│ Extension Stripping (FIX)               │
│ tagSlug = "typescript"                  │
└─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────┐
│ Case-Insensitive Lookup                 │
│ TagIndex.getTagBySlug(tagSlug.lower())  │
└─────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
      Tag Found               Tag Not Found
            │                       │
            ▼                       ▼
    Render tag.html           Return 404
```

## State Transitions

This feature has no state transitions - tags are derived from article front matter at build/startup time.

## New Data Structures

None. All required models exist and are sufficient for this bug fix.
