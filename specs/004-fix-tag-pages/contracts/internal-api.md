# Internal API Contracts: Fix Individual Tag Pages

**Feature Branch**: `004-fix-tag-pages`
**Date**: 2025-12-25

## Dev Server Module Contracts

### server.ts (Modification)

**Current Implementation** (broken):
```typescript
fastify.get<{ Params: { tag: string } }>('/tags/:tag', async (request, reply) => {
  const { tag } = request.params;
  // BUG: tag contains "typescript.html", not "typescript"
  const matchedTag = allTags.find(
    (t) => t.toLowerCase() === tag.toLowerCase()
  );
  // ...
});
```

**Required Change**:
```typescript
fastify.get<{ Params: { tag: string } }>('/tags/:tag', async (request, reply) => {
  const { tag } = request.params;
  const tagSlug = tag.replace(/\.html$/, '');  // Strip extension
  const matchedTag = allTags.find(
    (t) => t.toLowerCase() === tagSlug.toLowerCase()
  );
  // ...
});
```

**Contract**:
- Input: `tag` parameter from URL path (may include `.html` extension)
- Output: Rendered HTML string or 404 response
- Side effects: Updates `state.tagPages` cache on successful render

## Production Renderer Contracts

### RenderService (New Methods)

**Location**: `packages/renderer/src/services/render-service.ts`

#### renderTagPage(tag: Tag, articles: Article[]): Promise<string>

Generates HTML for an individual tag page.

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `tag` | `Tag` | Tag entity with slug, name, count |
| `articles` | `Article[]` | Articles with this tag |

**Returns**: `Promise<string>` - Complete HTML document

**Contract**:
```typescript
async renderTagPage(tag: Tag, articles: Article[]): Promise<string> {
  // 1. Sort articles by date (newest first)
  const sortedArticles = ArticleSorter.sortByDate(articles, 'desc');

  // 2. Build template context
  const context: TagPageContext = {
    tagName: tag.name,
    tagSlug: tag.slug,
    articleCount: tag.count,
    isPlural: tag.count !== 1,
    articles: sortedArticles.map(article => ({
      slug: article.slug,
      title: article.title,
      dateIso: article.date.toISOString(),
      dateFormatted: formatDate(article.date),
      excerpt: article.excerpt
    })),
    year: new Date().getFullYear()
  };

  // 3. Render using tag.html template
  const template = await this.loadTemplate('tag.html');
  return template(context);
}
```

**Error Handling**:
- Throws if template not found
- Throws if articles array contains invalid data

#### publishTagPage(tag: Tag, articles: Article[]): Promise<void>

Renders and publishes a tag page to S3.

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `tag` | `Tag` | Tag entity |
| `articles` | `Article[]` | Articles with this tag |

**Returns**: `Promise<void>`

**Side Effects**:
- Writes `tags/{slug}.html` to S3 bucket
- May trigger CloudFront invalidation (depends on configuration)

**Contract**:
```typescript
async publishTagPage(tag: Tag, articles: Article[]): Promise<void> {
  // 1. Render the tag page
  const html = await this.renderTagPage(tag, articles);

  // 2. Write to S3
  await this.s3Client.putObject({
    Bucket: this.config.bucketName,
    Key: `tags/${tag.slug}.html`,
    Body: html,
    ContentType: 'text/html; charset=utf-8'
  });
}
```

#### publishAllTagPages(tagIndex: TagIndex, articles: Article[]): Promise<void>

Iterates through all tags and publishes individual pages.

**Parameters**:
| Name | Type | Description |
|------|------|-------------|
| `tagIndex` | `TagIndex` | Complete tag index |
| `articles` | `Article[]` | All articles in the system |

**Returns**: `Promise<void>`

**Contract**:
```typescript
async publishAllTagPages(tagIndex: TagIndex, articles: Article[]): Promise<void> {
  const tags = tagIndex.getAllTags();

  for (const tag of tags) {
    // Get articles for this specific tag
    const tagArticles = articles.filter(a =>
      a.tags.some(t => normalizeTagSlug(t) === tag.slug)
    );

    await this.publishTagPage(tag, tagArticles);
  }
}
```

## Integration Points

### Render Workflow Integration

The `publishAllTagPages` method should be called in the main render workflow:

```typescript
// In handler.ts or main render orchestration
async function handleRenderComplete(): Promise<void> {
  // ... existing article rendering ...

  // Existing: Generate all-tags page
  await renderService.publishAllTagsPage(tagIndex);

  // NEW: Generate individual tag pages
  await renderService.publishAllTagPages(tagIndex, articles);
}
```

### Dependency Order

```
1. Parse all articles           ─┐
2. Build TagIndex from articles ─┤
3. Render individual articles   ─┤ (can parallelize)
4. Render all-tags page         ─┘
5. Render individual tag pages  ← NEW (depends on TagIndex)
```
