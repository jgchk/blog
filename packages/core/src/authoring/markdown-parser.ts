import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root } from 'mdast';
import type { ArticleIndex } from '../linking/article-index.js';
import { remarkWikilinks } from '../linking/wikilinks.js';

/** Fully-configured markdown-to-HTML processor type */
type MarkdownProcessor = Processor<Root, Root, Root, Root, string>;

/**
 * Options for configuring the MarkdownParser
 */
export interface MarkdownParserOptions {
  /** Optional ArticleIndex for resolving [[wikilinks]] */
  articleIndex?: ArticleIndex;
}

/**
 * Result of parsing markdown, includes broken links if wikilinks are enabled
 */
export interface ParseResult {
  html: string;
  brokenLinks: string[];
}

/**
 * Parses markdown to HTML using the unified/remark pipeline.
 * Per research.md specification.
 */
export class MarkdownParser {
  private processor: MarkdownProcessor;
  private articleIndex: ArticleIndex | undefined;

  constructor(options?: MarkdownParserOptions) {
    this.articleIndex = options?.articleIndex;
    this.processor = this.buildProcessor();
  }

  /**
   * Build the unified processor pipeline
   */
  private buildProcessor(): MarkdownProcessor {
    const baseProcessor = unified()
      .use(remarkParse)
      .use(remarkGfm);

    // Add wikilinks plugin if articleIndex is provided
    const withWikilinks = this.articleIndex
      ? baseProcessor.use(remarkWikilinks, { articleIndex: this.articleIndex })
      : baseProcessor;

    return withWikilinks
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeHighlight, { detect: true, ignoreMissing: true })
      .use(rehypeStringify, { allowDangerousHtml: true }) as MarkdownProcessor;
  }

  /**
   * Update the article index and rebuild the processor
   * Useful when the index changes during a batch render
   */
  setArticleIndex(articleIndex: ArticleIndex): void {
    this.articleIndex = articleIndex;
    this.processor = this.buildProcessor();
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
   * Parse markdown and return full result including broken links
   * @param markdown - The markdown content (without front matter)
   * @returns ParseResult with HTML and any broken wikilinks
   */
  async parseWithMetadata(markdown: string): Promise<ParseResult> {
    if (!markdown.trim()) {
      return { html: '', brokenLinks: [] };
    }

    const result = await this.processor.process(markdown);
    const brokenLinks = (result.data as { brokenLinks?: string[] })?.brokenLinks ?? [];

    return {
      html: String(result),
      brokenLinks,
    };
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
