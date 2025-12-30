/**
 * @deprecated Import from bounded contexts instead:
 * - '@blog/core/authoring' for FrontMatterParser, MarkdownParser
 * - '@blog/core/publishing' for ArticleValidator, TagIndex, ArticleSorter, etc.
 * - '@blog/core/linking' for ArticleIndex, CrossLinkResolver
 */

// Re-export from authoring
export { FrontMatterParser } from '../authoring/front-matter-parser.js';
export type { ParseResult } from '../authoring/front-matter-parser.js';

export { MarkdownParser } from '../authoring/markdown-parser.js';
export type {
  MarkdownParserOptions,
  ParseResult as MarkdownParseResult,
} from '../authoring/markdown-parser.js';

// Re-export from publishing
export { ArticleValidator } from '../publishing/article-validator.js';
export type { ValidationResult } from '../publishing/article-validator.js';

export { TagIndex } from '../publishing/tag-index.js';
export type { TagIndexJSON } from '../publishing/tag-index.js';

export { ArticleSorter } from '../publishing/article-sorter.js';

export { ArticleFactory } from '../publishing/article-factory.js';
export type { CreateParsedArticleInput } from '../publishing/article-factory.js';

export { ArchiveBuilder } from '../publishing/archive-builder.js';
export type { ArchiveGroup } from '../publishing/archive-builder.js';

export { PostScanner } from '../publishing/post-scanner.js';

// Re-export from linking
export { ArticleIndex } from '../linking/article-index.js';
export { CrossLinkResolver } from '../linking/cross-link-resolver.js';
