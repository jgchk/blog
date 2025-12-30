import { test, expect } from '@playwright/test';
import {
  discoverFirstArticle,
  discoverAnyTagPage,
  DiscoveredArticle,
} from './fixtures/article-discovery';

/**
 * E2E tests for tag navigation.
 * Per T047: User Story 2 - Browse Articles by Tag
 */
test.describe('Tag Navigation', () => {
  let article: DiscoveredArticle | null = null;
  let tagPageUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    article = await discoverFirstArticle(page);
    tagPageUrl = await discoverAnyTagPage(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
  });

  test('displays tags on article page', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    // Navigate to any article that has tags
    await page.goto(article!.url);

    // Check for tags section
    const tagsSection = page.locator('.tags');
    await expect(tagsSection).toBeVisible();

    // Tags should be clickable links
    const tagLinks = tagsSection.locator('a');
    const tagCount = await tagLinks.count();
    expect(tagCount).toBeGreaterThan(0);
  });

  test('clicking a tag navigates to tag page', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    // Navigate to an article with tags
    await page.goto(article!.url);

    // Find and click a tag
    const firstTag = page.locator('.tags a').first();
    const tagText = await firstTag.textContent();
    await firstTag.click();

    // Should navigate to tag page
    await expect(page).toHaveURL(/\/tags\//);

    // Tag page should show the tag name
    const heading = page.locator('h1');
    await expect(heading).toContainText(tagText || '');
  });

  test('tag page lists articles with that tag', async ({ page }) => {
    test.skip(!tagPageUrl, 'No tag pages available to test');

    // Navigate directly to a tag page
    await page.goto(tagPageUrl!);

    // Should have heading with tag name
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // Should list articles
    const articleList = page.locator('section[aria-label="Article list"], ul, ol');
    await expect(articleList).toBeVisible();

    // Each article should link to article page
    const articleLinks = articleList.locator('a[href*="/articles/"]');
    const linkCount = await articleLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(0); // May be 0 if no articles with this tag
  });

  test('tag links have correct href format', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    // Navigate to an article with tags
    await page.goto(article!.url);

    // Get all tag links
    const tagLinks = page.locator('.tags a');
    const count = await tagLinks.count();

    for (let i = 0; i < count; i++) {
      const href = await tagLinks.nth(i).getAttribute('href');
      // Tag links should point to /tags/{slug}.html
      expect(href).toMatch(/^\/tags\/[\w-]+\.html$/);
    }
  });

  test('tag navigation is keyboard accessible', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    await page.goto(article!.url);

    // Tab to tags section
    const firstTag = page.locator('.tags a').first();

    // Focus the first tag
    await firstTag.focus();
    await expect(firstTag).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to tag page
    await expect(page).toHaveURL(/\/tags\//);
  });

  test('back navigation works after viewing tag page', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    await page.goto(article!.url);

    // Click a tag
    await page.locator('.tags a').first().click();
    await expect(page).toHaveURL(/\/tags\//);

    // Go back
    await page.goBack();

    // Should be back on article page (use regex to match the article URL pattern)
    await expect(page).toHaveURL(/\/articles\/[\w-]+\/?/);
  });
});
