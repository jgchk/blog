import type { Slug } from './slug.js';
import type { Tag } from './tag.js';

/**
 * Common properties shared between ParsedArticle and Article.
 * These represent the domain-independent attributes of a blog post.
 */
interface ArticleBase {
  /** Unique identifier derived from folder name (filesystem-enforced uniqueness) */
  slug: Slug;

  /** Display title from front matter */
  title: string;

  /** Publication date from front matter (ISO 8601) */
  date: Date;

  /** Associated tags - uses Tag value objects for type safety */
  tags: readonly Tag[];

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

/**
 * Stage 1: Parsing result - contains raw markdown, no rendered HTML.
 * This is the output of the Content Authoring context.
 */
export interface ParsedArticle extends ArticleBase {
  /** Raw markdown content (without front matter) */
  content: string;
}

/**
 * Stage 2: Publishing-ready article - contains rendered HTML, no raw markdown.
 * This is the output of the Content Publishing context, ready for presentation.
 */
export interface Article extends ArticleBase {
  /** Rendered HTML content */
  html: string;
}
