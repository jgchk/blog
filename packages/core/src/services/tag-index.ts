import type { Article } from '../models/article.js';
import type { Tag, TagWithStats } from '../models/tag.js';

/**
 * Internal structure for tracking tag data
 */
interface TagData {
  /** Immutable tag info */
  tag: Tag;
  /** Article slugs with this tag */
  articles: string[];
}

/**
 * Serializable tag index for JSON export
 */
export interface TagIndexJSON {
  tags: TagWithStats[];
  totalTags: number;
}

/**
 * Builds and manages an index of tags across all articles.
 * Tags are stored as immutable Value Objects; statistics are computed on demand.
 */
export class TagIndex {
  private tagMap: Map<string, TagData> = new Map();

  private constructor() {}

  /**
   * Build tag index from array of articles
   */
  static buildFromArticles(articles: Article[]): TagIndex {
    const index = new TagIndex();

    for (const article of articles) {
      for (const tag of article.tags) {
        index.addTag(tag, article.slug.toString());
      }
    }

    return index;
  }

  /**
   * Add a tag reference for an article
   */
  private addTag(tag: Tag, articleSlug: string): void {
    const slug = tag.slug;
    if (!slug) return;

    let data = this.tagMap.get(slug);

    if (!data) {
      data = {
        tag, // Use the Tag value object directly
        articles: [],
      };
      this.tagMap.set(slug, data);
    }

    if (!data.articles.includes(articleSlug)) {
      data.articles.push(articleSlug);
    }
  }

  /**
   * Get all tags as immutable Tag objects (without stats)
   */
  get tags(): Tag[] {
    return Array.from(this.tagMap.values()).map(data => data.tag);
  }

  /**
   * Get total number of unique tags
   */
  get totalTags(): number {
    return this.tagMap.size;
  }

  /**
   * Get the most used tag with stats
   */
  get mostUsed(): TagWithStats | null {
    let maxData: TagData | null = null;
    let maxCount = 0;

    for (const data of this.tagMap.values()) {
      if (data.articles.length > maxCount) {
        maxCount = data.articles.length;
        maxData = data;
      }
    }

    if (!maxData) return null;

    return {
      ...maxData.tag,
      count: maxData.articles.length,
      articles: [...maxData.articles],
    };
  }

  /**
   * Get tag by slug (without stats)
   */
  getTagBySlug(slug: string): Tag | undefined {
    return this.tagMap.get(slug)?.tag;
  }

  /**
   * Get tag with stats by slug
   */
  getTagWithStats(slug: string): TagWithStats | undefined {
    const data = this.tagMap.get(slug);
    if (!data) return undefined;

    return {
      ...data.tag,
      count: data.articles.length,
      articles: [...data.articles],
    };
  }

  /**
   * Get article slugs for a tag
   */
  getArticlesByTag(tagSlug: string): string[] {
    return [...(this.tagMap.get(tagSlug)?.articles ?? [])];
  }

  /**
   * Get all tags with stats, sorted by count (descending)
   */
  getAllTags(): TagWithStats[] {
    return Array.from(this.tagMap.values())
      .map(data => ({
        ...data.tag,
        count: data.articles.length,
        articles: [...data.articles],
      }))
      .sort((a, b) => b.count - a.count);
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
