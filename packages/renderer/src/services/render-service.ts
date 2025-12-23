import {
  FrontMatterParser,
  MarkdownParser,
  type Article,
  type StorageAdapter,
  type ValidationError,
} from '@blog/core';

/**
 * Result of rendering an article
 */
export type RenderResult =
  | { success: true; article: Article }
  | { success: false; error: ValidationError };

/**
 * Orchestrates the markdown → HTML rendering pipeline.
 * Per research.md specification.
 */
export class RenderService {
  private frontMatterParser: FrontMatterParser;
  private markdownParser: MarkdownParser;
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.frontMatterParser = new FrontMatterParser();
    this.markdownParser = new MarkdownParser();
    this.storage = storage;
  }

  /**
   * Render a markdown file to an Article
   * @param markdown - Raw markdown content with front matter
   * @param slug - Article slug (from folder name)
   * @param sourcePath - Path to source file
   */
  async renderArticle(
    markdown: string,
    slug: string,
    sourcePath: string = `posts/${slug}/index.md`
  ): Promise<RenderResult> {
    // Parse front matter
    const parseResult = this.frontMatterParser.parse(markdown, sourcePath);

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    const { data: frontMatter, content } = parseResult;

    // Render markdown to HTML
    const html = await this.markdownParser.parse(content);

    // Generate excerpt
    const excerpt =
      frontMatter.excerpt ?? this.markdownParser.generateExcerpt(content);

    // Build article
    const article: Article = {
      slug,
      title: frontMatter.title,
      date: new Date(frontMatter.date),
      content,
      html,
      tags: frontMatter.tags ?? [],
      aliases: frontMatter.aliases ?? [],
      draft: frontMatter.draft ?? false,
      excerpt,
      sourcePath,
      updatedAt: new Date(),
    };

    return { success: true, article };
  }

  /**
   * Publish a rendered article to storage
   */
  async publishArticle(article: Article): Promise<void> {
    // Generate full HTML page
    const htmlPage = this.wrapInTemplate(article);

    // Write to storage
    await this.storage.write(
      `articles/${article.slug}/index.html`,
      Buffer.from(htmlPage, 'utf-8'),
      'text/html'
    );
  }

  /**
   * Wrap article HTML in a full page template
   */
  private wrapInTemplate(article: Article): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${this.escapeHtml(article.excerpt)}">
  <title>${this.escapeHtml(article.title)}</title>
  <link rel="stylesheet" href="/assets/styles/main.css">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/archive.html">Archive</a>
      <a href="/tags/">Tags</a>
    </nav>
  </header>
  <main>
    <article>
      <header>
        <h1>${this.escapeHtml(article.title)}</h1>
        <time datetime="${article.date.toISOString().split('T')[0]}">${this.formatDate(article.date)}</time>
        ${article.tags.length > 0 ? `<div class="tags">${article.tags.map((t) => `<a href="/tags/${this.slugify(t)}.html">${this.escapeHtml(t)}</a>`).join(' ')}</div>` : ''}
      </header>
      <div class="content">
        ${article.html}
      </div>
    </article>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()}</p>
  </footer>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}
