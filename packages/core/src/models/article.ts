import type { Slug } from './slug.js';

/**
 * A blog post created from a markdown file.
 * Per data-model.md specification.
 */
export interface Article {
  /** Unique identifier derived from folder name (filesystem-enforced uniqueness) */
  slug: Slug;

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

/**
 * Partial article before rendering (no HTML yet)
 */
export interface ParsedArticle
  extends Omit<Article, 'html'> {
  html?: string;
}
