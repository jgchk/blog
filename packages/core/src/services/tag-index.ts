import type { Article } from '../models/article.js';
import type { Tag } from '../models/tag.js';
import { normalizeTagSlug } from '../models/tag.js';

/**
 * Serializable tag index for JSON export
 */
export interface TagIndexJSON {
  tags: Tag[];
  totalTags: number;
}

/**
 * Builds and manages an index of tags across all articles.
 */
export class TagIndex {
  private tagMap: Map<string, Tag> = new Map();
  private _mostUsed: Tag | null = null;

  private constructor() {}

  /**
   * Build tag index from array of articles
   */
  static buildFromArticles(articles: Article[]): TagIndex {
    const index = new TagIndex();

    for (const article of articles) {
      for (const tagName of article.tags) {
        index.addTag(tagName, article.slug);
      }
    }

    // Calculate most used
    index.calculateMostUsed();

    return index;
  }

  /**
   * Add a tag reference for an article
   */
  private addTag(tagName: string, articleSlug: string): void {
    const slug = normalizeTagSlug(tagName);
    if (!slug) return;

    let tag = this.tagMap.get(slug);

    if (!tag) {
      tag = {
        slug,
        name: tagName, // First occurrence sets the display name
        count: 0,
        articles: [],
      };
      this.tagMap.set(slug, tag);
    }

    if (!tag.articles.includes(articleSlug)) {
      tag.articles.push(articleSlug);
      tag.count = tag.articles.length;
    }
  }

  /**
   * Calculate most used tag
   */
  private calculateMostUsed(): void {
    let maxCount = 0;
    this._mostUsed = null;

    for (const tag of this.tagMap.values()) {
      if (tag.count > maxCount) {
        maxCount = tag.count;
        this._mostUsed = tag;
      }
    }
  }

  /**
   * Get all tags
   */
  get tags(): Tag[] {
    return Array.from(this.tagMap.values());
  }

  /**
   * Get total number of unique tags
   */
  get totalTags(): number {
    return this.tagMap.size;
  }

  /**
   * Get the most used tag
   */
  get mostUsed(): Tag | null {
    return this._mostUsed;
  }

  /**
   * Get tag by slug
   */
  getTagBySlug(slug: string): Tag | undefined {
    return this.tagMap.get(slug);
  }

  /**
   * Get article slugs for a tag
   */
  getArticlesByTag(tagSlug: string): string[] {
    return this.tagMap.get(tagSlug)?.articles ?? [];
  }

  /**
   * Get all tags sorted by count (descending)
   */
  getAllTags(): Tag[] {
    return this.tags.sort((a, b) => b.count - a.count);
  }

  /**
   * Serialize to JSON
   */
  toJSON(): TagIndexJSON {
    return {
      tags: this.getAllTags(),
      totalTags: this.totalTags,
    };
  }
}
