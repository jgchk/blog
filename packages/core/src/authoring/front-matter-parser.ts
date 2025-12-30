import matter from 'gray-matter';
import type { FrontMatter } from './front-matter.js';
import type { ValidationError } from './validation-error.js';

/**
 * Result of parsing front matter
 */
export type ParseResult =
  | { success: true; data: FrontMatter; content: string }
  | { success: false; error: ValidationError };

/**
 * Parses YAML front matter from markdown files using gray-matter.
 */
export class FrontMatterParser {
  /**
   * Parse front matter from markdown content
   * @param markdown - The raw markdown content including front matter
   * @param path - Optional file path for error reporting
   */
  parse(markdown: string, path: string = ''): ParseResult {
    try {
      const { data, content } = matter(markdown);

      // Validate required fields
      if (typeof data.title !== 'string' || data.title.trim() === '') {
        return {
          success: false,
          error: { type: 'missing_title', path },
        };
      }

      if (typeof data.date !== 'string' && !(data.date instanceof Date)) {
        return {
          success: false,
          error: { type: 'missing_date', path },
        };
      }

      // Validate date format (YYYY-MM-DD)
      const rawDate = data.date instanceof Date
        ? data.date.toISOString().split('T')[0]
        : String(data.date);
      const dateStr = rawDate ?? '';

      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return {
          success: false,
          error: { type: 'invalid_date', path, value: dateStr },
        };
      }

      // Validate the date is actually valid
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        return {
          success: false,
          error: { type: 'invalid_date', path, value: dateStr },
        };
      }

      const frontMatter: FrontMatter = {
        title: data.title.trim(),
        date: dateStr,
      };

      // Optional fields
      if (Array.isArray(data.tags)) {
        frontMatter.tags = data.tags.map((t: unknown) => String(t));
      }

      if (Array.isArray(data.aliases)) {
        frontMatter.aliases = data.aliases.map((a: unknown) => String(a));
      }

      if (typeof data.draft === 'boolean') {
        frontMatter.draft = data.draft;
      }

      if (typeof data.excerpt === 'string') {
        frontMatter.excerpt = data.excerpt;
      }

      return {
        success: true,
        data: frontMatter,
        content,
      };
    } catch (err) {
      return {
        success: false,
        error: {
          type: 'invalid_yaml',
          path,
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }
}
