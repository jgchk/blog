import { Page } from '@playwright/test';

/**
 * Helper functions to dynamically discover articles and tags from the site.
 * This allows e2e tests to work with any articles present, not just placeholders.
 */

export interface DiscoveredArticle {
  url: string;
  slug: string;
}

export interface DiscoveredTag {
  url: string;
  name: string;
}

/**
 * Discovers the first available article from the homepage or archive.
 * Returns the article URL and slug, or null if no articles exist.
 */
export async function discoverFirstArticle(page: Page): Promise<DiscoveredArticle | null> {
  // Try homepage first
  await page.goto('/');

  let articleLink = page.locator('a[href*="/articles/"]').first();
  let count = await articleLink.count();

  // If no articles on homepage, try archive
  if (count === 0) {
    await page.goto('/archive/');
    articleLink = page.locator('a[href*="/articles/"]').first();
    count = await articleLink.count();
  }

  if (count === 0) {
    return null;
  }

  const href = await articleLink.getAttribute('href');
  if (!href) {
    return null;
  }

  // Extract slug from URL like /articles/example-post/ -> example-post
  const slugMatch = href.match(/\/articles\/([^/]+)/);
  const slug = slugMatch ? slugMatch[1] : '';

  return { url: href, slug };
}

/**
 * Discovers the first available tag from an article page.
 * Navigates to an article first if not already on one.
 */
export async function discoverFirstTag(page: Page): Promise<DiscoveredTag | null> {
  // First ensure we're on an article page
  const currentUrl = page.url();
  if (!currentUrl.includes('/articles/')) {
    const article = await discoverFirstArticle(page);
    if (!article) {
      return null;
    }
    await page.goto(article.url);
  }

  // Find tag links in the tags section
  const tagLink = page.locator('.tags a[href*="/tags/"]').first();
  const count = await tagLink.count();

  if (count === 0) {
    return null;
  }

  const href = await tagLink.getAttribute('href');
  const name = await tagLink.textContent();

  if (!href) {
    return null;
  }

  return { url: href, name: name?.trim() || '' };
}

/**
 * Discovers any available tag page URL from the tags listing.
 */
export async function discoverAnyTagPage(page: Page): Promise<string | null> {
  await page.goto('/tags/');

  const tagLink = page.locator('a[href*="/tags/"][href$=".html"]').first();
  const count = await tagLink.count();

  if (count === 0) {
    return null;
  }

  return await tagLink.getAttribute('href');
}

/**
 * Gets a list of page URLs to test, dynamically discovering the article URL.
 * Returns an array of URLs suitable for accessibility/performance testing.
 */
export async function getTestablePages(page: Page): Promise<string[]> {
  const pages = ['/', '/tags/', '/archive/'];

  const article = await discoverFirstArticle(page);
  if (article) {
    pages.push(article.url);
  }

  return pages;
}
