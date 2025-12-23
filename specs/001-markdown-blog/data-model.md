# Data Model: Lightweight Markdown Blog

**Date**: 2025-12-23
**Source**: spec.md Key Entities, Functional Requirements

---

## Core Entities

### Article

A blog post created from a markdown file.

```typescript
interface Article {
  /** Unique identifier derived from folder name (filesystem-enforced uniqueness) */
  slug: string;

  /** Display title from front matter */
  title: string;

  /** Publication date from front matter (ISO 8601) */
  date: Date;

  /** Raw markdown content (without front matter) */
  content: string;

  /** Rendered HTML content */
  html: string;

  /** Associated tags (references Tag.slug) */
  tags: string[];

  /** Optional aliases for cross-link resolution */
  aliases: string[];

  /** Whether article is excluded from publication */
  draft: boolean;

  /** Auto-generated excerpt (first 160 chars or custom) */
  excerpt: string;

  /** Path to source folder relative to posts directory */
  sourcePath: string;

  /** Last modified timestamp (from Git or filesystem) */
  updatedAt: Date;
}
```

**Validation Rules**:
- `slug`: Required, derived from folder name, URL-safe (lowercase, hyphens)
- `title`: Required, non-empty string
- `date`: Required, valid ISO 8601 date (YYYY-MM-DD)
- `content`: Required (but may be empty string)
- `tags`: Optional array, defaults to `[]`
- `aliases`: Optional array, defaults to `[]`
- `draft`: Optional boolean, defaults to `false`

**State Transitions**:
```
[Source] → [Parsed] → [Rendered] → [Published]

Source: Markdown file exists in posts/{slug}/index.md
Parsed: Front matter extracted, validation passed
Rendered: HTML generated, cross-links resolved
Published: Stored in S3, available via CloudFront
```

---

### Tag

A label for grouping related articles.

```typescript
interface Tag {
  /** URL-safe identifier */
  slug: string;

  /** Display name (original casing preserved) */
  name: string;

  /** Number of articles with this tag */
  count: number;

  /** Article slugs that have this tag */
  articles: string[];
}
```

**Validation Rules**:
- `slug`: Derived from name (lowercase, spaces/punctuation → hyphens)
- `name`: Required, non-empty, preserved from first occurrence
- `count`: Computed property, always equals `articles.length`

**Normalization**:
```
"JavaScript" → slug: "javascript", name: "JavaScript"
"Machine Learning" → slug: "machine-learning", name: "Machine Learning"
"C++" → slug: "c-plus-plus", name: "C++"
```

---

### FrontMatter

YAML metadata at the top of markdown files.

```typescript
interface FrontMatter {
  /** Article title (required) */
  title: string;

  /** Publication date (required) */
  date: string; // ISO 8601 format: YYYY-MM-DD

  /** Tags for categorization (optional) */
  tags?: string[];

  /** Alternative titles for cross-link resolution (optional) */
  aliases?: string[];

  /** Exclude from publication (optional, default: false) */
  draft?: boolean;

  /** Custom excerpt override (optional) */
  excerpt?: string;
}
```

**Example**:
```yaml
---
title: Getting Started with TypeScript
date: 2025-01-15
tags:
  - TypeScript
  - JavaScript
  - Tutorial
aliases:
  - TS Getting Started
  - TypeScript Intro
draft: false
---
```

---

### CrossLink

Represents an Obsidian-style `[[wikilink]]` in content.

```typescript
interface CrossLink {
  /** Original text inside [[ ]] */
  originalText: string;

  /** Normalized text for matching */
  normalizedText: string;

  /** Resolved target article slug (null if broken) */
  targetSlug: string | null;

  /** Whether link resolution succeeded */
  isResolved: boolean;

  /** Position in source content */
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}
```

**Normalization Rules** (FR-005):
```
"Article B Title" → "article-b-title"
"ARTICLE B TITLE" → "article-b-title"
"Article_B_Title" → "article-b-title"
"Article-B-Title" → "article-b-title"
```

**Resolution Order**:
1. Match against article `slug` (exact, normalized)
2. Match against article `title` (case-insensitive, normalized)
3. Match against any `aliases` (case-insensitive, normalized)
4. If no match → broken link

---

### SyncStatus

Admin dashboard status for Git sync operations.

```typescript
interface SyncStatus {
  /** Unique sync operation ID */
  syncId: string;

  /** Git commit hash that triggered sync */
  commitHash: string;

  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  /** Articles processed in this sync */
  articlesProcessed: number;

  /** Articles that failed to render */
  articlesFailed: number;

  /** Error details if failed */
  errors: SyncError[];

  /** Consecutive failure count (for alerting) */
  consecutiveFailures: number;

  /** Timestamps */
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

**Alert Trigger** (FR-014):
- Send SNS notification when `consecutiveFailures >= 3`

---

## Index Structures

### ArticleIndex

In-memory index for fast article lookup (built during rendering).

```typescript
interface ArticleIndex {
  /** Slug → Article lookup */
  bySlug: Map<string, Article>;

  /** Normalized title → slug lookup (for cross-links) */
  byTitle: Map<string, string>;

  /** Normalized alias → slug lookup (for cross-links) */
  byAlias: Map<string, string>;

  /** Tag slug → article slugs */
  byTag: Map<string, Set<string>>;

  /** Year-month → article slugs (for archives) */
  byMonth: Map<string, Set<string>>;
}
```

### TagIndex

Tag metadata for tag pages and tag cloud.

```typescript
interface TagIndex {
  /** All tags with article counts */
  tags: Tag[];

  /** Total unique tags */
  totalTags: number;

  /** Tag with most articles */
  mostUsed: Tag | null;
}
```

---

## Relationships

```
┌─────────────┐         ┌─────────────┐
│   Article   │ N ←──── │    Tag      │
│             │ ──────→ │             │
│ slug (PK)   │    M    │ slug (PK)   │
│ title       │         │ name        │
│ date        │         │ count       │
│ tags[]      │         │ articles[]  │
│ aliases[]   │         └─────────────┘
│ draft       │
│ ...         │
└──────┬──────┘
       │
       │ contains
       ▼
┌─────────────┐
│  CrossLink  │
│             │
│ originalText│
│ targetSlug  │
│ isResolved  │
└─────────────┘
```

---

## Storage Layout

### S3 Bucket Structure

```
blog-content-{env}/
├── articles/
│   ├── {slug}/
│   │   ├── index.html          # Rendered article page
│   │   └── assets/             # Co-located images
│   │       └── image.png
│   └── ...
├── tags/
│   ├── {tag-slug}.html         # Tag listing page
│   └── ...
├── pages/
│   ├── index.html              # Homepage (recent articles)
│   └── archive.html            # Archive page
├── assets/
│   └── styles/
│       └── main.css            # Site stylesheet
└── metadata/
    ├── articles.json           # Article index for client-side search (future)
    └── tags.json               # Tag index for tag cloud
```

### Git Repository (Source of Truth)

```
posts/
├── my-first-post/
│   ├── index.md                # Article source
│   └── image.png               # Co-located asset
└── another-post/
    └── index.md
```

---

## Validation Errors

```typescript
type ValidationError =
  | { type: 'missing_title'; path: string }
  | { type: 'missing_date'; path: string }
  | { type: 'invalid_date'; path: string; value: string }
  | { type: 'invalid_yaml'; path: string; message: string }
  | { type: 'duplicate_slug'; slug: string; paths: string[] }
  | { type: 'broken_crosslink'; articleSlug: string; linkText: string };
```

**Handling** (FR-011):
- Log warning for each validation error
- Exclude invalid articles from publication
- Valid articles continue to publish (don't block on invalid siblings)
