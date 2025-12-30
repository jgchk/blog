# Data Model: Pipeline-Based Rendering

**Feature**: 007-pipeline-rendering
**Date**: 2025-12-30

## Overview

This feature primarily modifies the rendering workflow rather than introducing new data entities. The existing `@blog/core` models remain unchanged. This document describes the data flow and key structures used in pipeline rendering.

## Existing Entities (No Changes)

### Article

Defined in `@blog/core`, represents a blog post.

```typescript
interface Article {
  slug: string;           // URL-safe identifier from directory name
  title: string;          // From front matter
  date: Date;             // Publication date from front matter
  content: string;        // Raw markdown content
  html: string;           // Rendered HTML
  tags: string[];         // Array of tag slugs
  aliases?: string[];     // Alternative URLs (optional)
  draft?: boolean;        // Draft status (excluded from render)
  excerpt: string;        // Auto-generated excerpt
  sourcePath: string;     // Path to source markdown file
  updatedAt: Date;        // Last modification time
}
```

**Validation Rules**:
- `slug`: Required, derived from directory name
- `title`: Required, non-empty string
- `date`: Required, valid date
- `content`: Required, valid markdown
- `tags`: Optional, array of strings

### TagIndex

Defined in `@blog/core`, manages tag-to-article relationships.

```typescript
interface TagIndex {
  tags: Map<string, Article[]>;  // Tag slug → articles with that tag

  addArticle(article: Article): void;
  getArticlesForTag(tag: string): Article[];
  getAllTags(): string[];
  getTagCounts(): Map<string, number>;
}
```

## Pipeline-Specific Structures

### RenderResult

Result of rendering a single post (new structure for pipeline context).

```typescript
interface RenderResult {
  slug: string;           // Post slug
  success: boolean;       // Whether rendering succeeded
  htmlPath: string;       // Output path for HTML
  assetPaths: string[];   // Output paths for copied assets
  error?: Error;          // Error if failed
  duration: number;       // Render time in ms
}
```

### PipelineContext

Configuration and state for a pipeline render run.

```typescript
interface PipelineContext {
  // Configuration
  postsDir: string;       // Source: ./posts
  outputDir: string;      // Destination: ./rendered
  s3Bucket: string;       // Target S3 bucket
  cloudfrontId: string;   // CloudFront distribution ID

  // State
  startTime: Date;        // Pipeline start timestamp
  articles: Article[];    // All parsed articles
  results: RenderResult[];// Render results per post
  tagIndex: TagIndex;     // Built tag index

  // Metrics
  totalPosts: number;
  renderedPosts: number;
  failedPosts: number;
  totalAssets: number;
}
```

### PipelineOutput

Final output of pipeline execution.

```typescript
interface PipelineOutput {
  success: boolean;               // Overall success
  duration: number;               // Total time in ms
  postsRendered: number;          // Successfully rendered posts
  postsFailed: number;            // Failed posts (should be 0 on success)
  assetsUploaded: number;         // Total assets uploaded
  tagPagesGenerated: number;      // Tag pages created
  invalidationId: string | null;  // CloudFront invalidation ID
  errors: Array<{                 // Error details if any
    slug: string;
    message: string;
  }>;
}
```

## File Structure

### Input (Repository)

```
posts/
├── example-post/
│   ├── index.md          # Markdown with front matter
│   └── hero.jpg          # Co-located asset
└── another-post/
    └── index.md
```

### Output (Local before upload)

```
rendered/
├── posts/
│   ├── example-post/
│   │   ├── index.html    # Rendered HTML
│   │   └── hero.jpg      # Copied asset
│   └── another-post/
│       └── index.html
├── tags/
│   ├── index.html        # All tags page
│   ├── javascript.html   # Tag index page
│   └── typescript.html   # Tag index page
└── pages/
    └── index.html        # Home page
```

### Output (S3)

Same structure as local output, uploaded to S3 bucket root.

## State Transitions

### Pipeline Execution States

```
INIT → READING → RENDERING → UPLOADING → INVALIDATING → COMPLETE
  │       │         │           │             │
  └───────┴─────────┴───────────┴─────────────┴──→ FAILED (on any error)
```

| State | Description | Exit Condition |
|-------|-------------|----------------|
| INIT | Pipeline starting | Configuration validated |
| READING | Discovering and parsing posts | All posts read |
| RENDERING | Converting markdown to HTML | All posts rendered |
| UPLOADING | Syncing to S3 | All files uploaded |
| INVALIDATING | Creating CloudFront invalidation | Invalidation created |
| COMPLETE | Pipeline succeeded | Terminal state |
| FAILED | Pipeline failed | Terminal state (on any error) |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Runner                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  posts/           ┌────────────────┐       rendered/            │
│  ├── post-1/ ───> │ PipelineRunner │ ───> ├── posts/            │
│  └── post-2/      │                │       │   ├── post-1/       │
│                   │  1. Read posts │       │   └── post-2/       │
│                   │  2. Parse MD   │       ├── tags/             │
│                   │  3. Render HTML│       └── pages/            │
│                   │  4. Copy assets│                             │
│                   │  5. Build tags │                             │
│                   └────────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ aws s3 sync
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS S3                                   │
│  blog-content-prod-{account}/                                   │
│  ├── posts/                                                     │
│  ├── tags/                                                      │
│  └── pages/                                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ CloudFront invalidation
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CloudFront CDN                              │
│  https://blog.example.com/*                                     │
└─────────────────────────────────────────────────────────────────┘
```

## No Database/Persistence Changes

This feature does not introduce:
- New database tables
- State persistence between runs
- Caching layers
- External service integrations (beyond existing S3/CloudFront)

All state is ephemeral within the pipeline run. The "source of truth" remains:
- Git repository (content)
- S3 bucket (rendered output)
