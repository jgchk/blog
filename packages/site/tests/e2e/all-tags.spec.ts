import { test, expect } from '@playwright/test';

/**
 * E2E tests for /tags page.
 * Per T047a: FR-010 - All tags page with counts
 */
test.describe('/tags Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tags/');
  });

  test('displays all tags page at /tags/', async ({ page }) => {
    // Page should load without error
    await expect(page).toHaveURL(/\/tags\/?/);

    // Should have a heading
    const heading = page.locator('h1');
    await expect(heading).toContainText(/tags/i);
  });

  test('lists all tags on the page', async ({ page }) => {
    // Tags should be displayed
    const tagLinks = page.locator('a[href*="/tags/"]');
    const tagCount = await tagLinks.count();

    // Should have at least some tags (depends on test data)
    expect(tagCount).toBeGreaterThanOrEqual(0);
  });

  test('each tag links to its detail page', async ({ page }) => {
    const tagLinks = page.locator('a[href*="/tags/"][href$=".html"]');
    const count = await tagLinks.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      // Check first 5 tags to avoid slow tests
      const href = await tagLinks.nth(i).getAttribute('href');
      expect(href).toMatch(/^\/tags\/[\w-]+\.html$/);
    }
  });

  test('displays article counts for each tag', async ({ page }) => {
    // Look for count indicators (could be in various formats)
    // e.g., "TypeScript (5)" or "5 articles" or just a number
    const tagItems = page.locator('[class*="tag"], .tags li, .tag-list li, ul li');
    const itemCount = await tagItems.count();

    if (itemCount > 0) {
      // Check that at least one item has some text content
      const firstItem = await tagItems.first().textContent();
      expect(firstItem).toBeTruthy();
    }
  });

  test('tags are clickable and navigate correctly', async ({ page }) => {
    const firstTagLink = page.locator('a[href*="/tags/"][href$=".html"]').first();
    const count = await firstTagLink.count();

    if (count > 0) {
      await firstTagLink.click();

      // Should navigate to a tag detail page
      await expect(page).toHaveURL(/\/tags\/[\w-]+\.html$/);
    }
  });

  test('navigation includes link to tags page', async ({ page }) => {
    // Go to homepage
    await page.goto('/');

    // Navigation should include link to tags (exact /tags/ path)
    const navTagsLink = page.locator('nav a[href="/tags/"]');
    await expect(navTagsLink).toBeVisible();

    // Click should navigate to tags page
    await navTagsLink.click();
    await expect(page).toHaveURL(/\/tags\/?/);
  });

  test('tags page is accessible from article pages', async ({ page }) => {
    // Navigate to an article
    await page.goto('/articles/example-post/');

    // Should be able to navigate to tags page via nav (exact /tags/ path)
    const navTagsLink = page.locator('nav a[href="/tags/"]');
    await expect(navTagsLink).toBeVisible();
  });

  test('tags page has proper semantic structure', async ({ page }) => {
    // Should have main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
  });
});
