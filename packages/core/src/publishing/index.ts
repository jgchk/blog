/**
 * Publishing Bounded Context
 *
 * Handles article validation and assembly into publishable objects.
 * Concepts: Article, Tag, Slug, Archive
 * Boundary: ParsedArticle → Article (validated, ready for publication)
 */

// Models
export type { Article, ParsedArticle } from './article.js';
export type { Tag, TagWithStats } from './tag.js';
export { createTag } from './tag.js';
export { Slug } from './slug.js';

// Services
export { ArticleValidator } from './article-validator.js';
export type { ValidationResult } from './article-validator.js';

export { TagIndex } from './tag-index.js';
export type { TagIndexJSON } from './tag-index.js';

export { ArticleSorter } from './article-sorter.js';

export { ArticleFactory } from './article-factory.js';
export type { CreateParsedArticleInput } from './article-factory.js';

export { ArchiveBuilder } from './archive-builder.js';
export type { ArchiveGroup } from './archive-builder.js';

export { PostScanner } from './post-scanner.js';
