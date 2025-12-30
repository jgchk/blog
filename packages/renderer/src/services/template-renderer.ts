import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import { normalizeTagSlug, type Article, type TagWithStats } from '@blog/core';

/**
 * Template context for rendering an article page
 */
export interface ArticleTemplateContext {
  title: string;
  excerpt: string;
  content: string;
  dateIso: string;
  dateFormatted: string;
  tags: Array<{ name: string; slug: string }>;
  year: number;
  prevArticle?: { slug: string; title: string };
  nextArticle?: { slug: string; title: string };
}

/**
 * Template context for rendering a tag page
 */
export interface TagPageTemplateContext {
  tagName: string;
  tagSlug: string;
  articleCount: number;
  isPlural: boolean;
  articles: Array<{
    slug: string;
    title: string;
    dateIso: string;
    dateFormatted: string;
    excerpt: string;
  }>;
  year: number;
}

/**
 * Template context for rendering all-tags page
 */
export interface AllTagsTemplateContext {
  tags: Array<{ name: string; slug: string; count: number }>;
  totalTags: number;
  year: number;
}

/**
 * Handles template loading and rendering using Handlebars.
 * Consolidates template logic that was previously duplicated
 * between RenderService and PipelineRenderer.
 */
export class TemplateRenderer {
  private templatesDir: string;
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
  }

  /**
   * Load and compile a Handlebars template
   */
  async loadTemplate(name: string): Promise<Handlebars.TemplateDelegate> {
    const cached = this.templateCache.get(name);
    if (cached) return cached;

    const templatePath = path.join(this.templatesDir, `${name}.html`);
    const templateSource = await fs.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateSource);

    this.templateCache.set(name, compiled);
    return compiled;
  }

  /**
   * Clear the template cache (useful when templates change)
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Format a date for display
   */
  formatDate(date: Date): { dateIso: string; dateFormatted: string } {
    const dateIso = date.toISOString().split('T')[0] ?? '';
    const dateFormatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return { dateIso, dateFormatted };
  }

  /**
   * Render an article page
   */
  async renderArticle(article: Article): Promise<string> {
    const template = await this.loadTemplate('article');
    const { dateIso, dateFormatted } = this.formatDate(article.date);

    const context: ArticleTemplateContext = {
      title: article.title,
      excerpt: article.excerpt,
      content: article.html,
      dateIso,
      dateFormatted,
      tags: article.tags.map(tag => ({
        name: tag,
        slug: normalizeTagSlug(tag),
      })),
      year: new Date().getFullYear(),
    };

    return template(context);
  }

  /**
   * Render a tag page
   */
  async renderTagPage(tag: TagWithStats, articles: Article[]): Promise<string> {
    const template = await this.loadTemplate('tag');

    // Sort articles by date (newest first)
    const sortedArticles = [...articles].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    const context: TagPageTemplateContext = {
      tagName: tag.name,
      tagSlug: tag.slug,
      articleCount: sortedArticles.length,
      isPlural: sortedArticles.length !== 1,
      articles: sortedArticles.map(article => {
        const { dateIso, dateFormatted } = this.formatDate(article.date);
        return {
          slug: article.slug,
          title: article.title,
          dateIso,
          dateFormatted,
          excerpt: article.excerpt,
        };
      }),
      year: new Date().getFullYear(),
    };

    return template(context);
  }

  /**
   * Render all-tags page
   */
  async renderAllTagsPage(
    tags: Array<{ name: string; slug: string; count: number }>
  ): Promise<string> {
    const template = await this.loadTemplate('tags');

    // Sort alphabetically by name (case-insensitive)
    const sortedTags = [...tags].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    const context: AllTagsTemplateContext = {
      tags: sortedTags,
      totalTags: sortedTags.length,
      year: new Date().getFullYear(),
    };

    return template(context);
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * Default templates path relative to project root
 */
export const DEFAULT_TEMPLATES_DIR = './packages/site/src/templates';
