/**
 * Manages rendered HTML storage for pages.
 */
export class RenderCache {
  private _indexHtml = '';
  private _archiveHtml = '';
  private _allTagsHtml = '';
  private _tagPages: Map<string, string> = new Map();

  /**
   * Get the rendered index page HTML.
   */
  get indexHtml(): string {
    return this._indexHtml;
  }

  /**
   * Set the rendered index page HTML.
   */
  setIndex(html: string): void {
    this._indexHtml = html;
  }

  /**
   * Get the rendered archive page HTML.
   */
  get archiveHtml(): string {
    return this._archiveHtml;
  }

  /**
   * Set the rendered archive page HTML.
   */
  setArchive(html: string): void {
    this._archiveHtml = html;
  }

  /**
   * Get the rendered all tags page HTML.
   */
  get allTagsHtml(): string {
    return this._allTagsHtml;
  }

  /**
   * Set the rendered all tags page HTML.
   */
  setAllTags(html: string): void {
    this._allTagsHtml = html;
  }

  /**
   * Get a tag page by slug.
   */
  getTagPage(tagSlug: string): string | undefined {
    return this._tagPages.get(tagSlug);
  }

  /**
   * Set a tag page.
   */
  setTagPage(tagSlug: string, html: string): void {
    this._tagPages.set(tagSlug, html);
  }

  /**
   * Get all tag slugs with cached pages.
   */
  getTagSlugs(): string[] {
    return Array.from(this._tagPages.keys());
  }

  /**
   * Check if the cache has any content.
   */
  hasContent(): boolean {
    return (
      this._indexHtml !== '' ||
      this._archiveHtml !== '' ||
      this._allTagsHtml !== '' ||
      this._tagPages.size > 0
    );
  }

  /**
   * Clear all cached HTML.
   */
  clear(): void {
    this._indexHtml = '';
    this._archiveHtml = '';
    this._allTagsHtml = '';
    this._tagPages.clear();
  }
}
