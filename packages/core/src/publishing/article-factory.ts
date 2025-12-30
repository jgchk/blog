import { createTag, type Tag } from './tag.js';
import type { Slug } from './slug.js';
import type { FrontMatter } from '../authoring/front-matter.js';
import type { Article, ParsedArticle } from './article.js';

/**
 * Input for creating a ParsedArticle.
 */
export interface CreateParsedArticleInput {
  /** Parsed front matter from markdown file */
  frontMatter: FrontMatter;

  /** Raw markdown content (without front matter) */
  content: string;

  /** URL-safe slug (typically from folder name) */
  slug: Slug;

  /** Path to source file relative to posts directory */
  sourcePath: string;

  /** Optional last modified timestamp (defaults to now) */
  updatedAt?: Date;
}

/**
 * Factory for creating Article domain objects.
 * Centralizes article construction logic from front matter and content.
 */
export class ArticleFactory {
  /**
   * Create a ParsedArticle from front matter and markdown content.
   * This is Stage 1 in the article lifecycle - content has been parsed but not rendered.
   */
  createParsedArticle(input: CreateParsedArticleInput): ParsedArticle {
    const { frontMatter, content, slug, sourcePath, updatedAt } = input;

    const tags: readonly Tag[] = (frontMatter.tags ?? []).map(createTag);
    const excerpt = frontMatter.excerpt ?? this.generateExcerpt(content);

    return {
      slug,
      title: frontMatter.title,
      date: new Date(frontMatter.date),
      content,
      tags,
      aliases: frontMatter.aliases ?? [],
      draft: frontMatter.draft ?? false,
      excerpt,
      sourcePath,
      updatedAt: updatedAt ?? new Date(),
    };
  }

  /**
   * Create an Article from a ParsedArticle and rendered HTML.
   * This is Stage 2 in the article lifecycle - ready for publication.
   */
  createArticle(parsedArticle: ParsedArticle, html: string): Article {
    return {
      slug: parsedArticle.slug,
      title: parsedArticle.title,
      date: parsedArticle.date,
      html,
      tags: parsedArticle.tags,
      aliases: parsedArticle.aliases,
      draft: parsedArticle.draft,
      excerpt: parsedArticle.excerpt,
      sourcePath: parsedArticle.sourcePath,
      updatedAt: parsedArticle.updatedAt,
    };
  }

  /**
   * Generate an excerpt from markdown content.
   * Strips markdown syntax and truncates to 160 characters.
   */
  private generateExcerpt(content: string): string {
    // Strip common markdown syntax
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '') // Headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1') // Wikilinks
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Images
      .replace(/^>\s+/gm, '') // Blockquotes
      .replace(/^[-*+]\s+/gm, '') // List items
      .replace(/^\d+\.\s+/gm, '') // Numbered lists
      .replace(/\n+/g, ' ') // Newlines to spaces
      .trim();

    if (plainText.length <= 160) {
      return plainText;
    }

    return plainText.slice(0, 160) + '...';
  }
}
