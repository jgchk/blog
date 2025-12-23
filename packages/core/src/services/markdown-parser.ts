import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

/**
 * Parses markdown to HTML using the unified/remark pipeline.
 * Per research.md specification.
 */
export class MarkdownParser {
  private processor: ReturnType<typeof unified>;

  constructor() {
    this.processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight, { detect: true, ignoreMissing: true })
      .use(rehypeStringify, { allowDangerousHtml: true });
  }

  /**
   * Parse markdown content to HTML
   * @param markdown - The markdown content (without front matter)
   * @returns The rendered HTML
   */
  async parse(markdown: string): Promise<string> {
    if (!markdown.trim()) {
      return '';
    }

    const result = await this.processor.process(markdown);
    return String(result);
  }

  /**
   * Generate an excerpt from markdown content
   * @param content - The markdown content
   * @param maxLength - Maximum length of excerpt (default: 160)
   * @returns Plain text excerpt
   */
  generateExcerpt(content: string, maxLength: number = 160): string {
    // Strip markdown formatting
    const plainText = content
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      // Remove links - keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    return plainText.slice(0, maxLength) + '...';
  }
}
