/**
 * Linking Bounded Context
 *
 * Manages cross-article relationships via wikilinks and metadata.
 * Concepts: CrossLink, Wikilink, ArticleIndex
 * Boundary: Article references → Resolved links
 */

// Models
export type { CrossLink, CrossLinkResolution } from './cross-link.js';

// Services
export { ArticleIndex } from './article-index.js';
export { CrossLinkResolver } from './cross-link-resolver.js';

// Re-export Slug for cross-link resolution (shared with publishing)
export { Slug } from '../publishing/slug.js';

// Re-export Article type for index building (shared with publishing)
export type { Article } from '../publishing/article.js';

// Plugins for wikilink transformation
export { remarkWikilinks } from './wikilinks.js';
