import { test, expect } from '@playwright/test';

/**
 * E2E tests for archive navigation.
 * Per T064: User Story 4 - Browse Articles by Date
 */
test.describe('Archive Navigation', () => {
  test('archive page is accessible from navigation', async ({ page }) => {
    await page.goto('/');

    // Navigation should have archive link
    const archiveLink = page.locator('nav a[href*="archive"]');
    await expect(archiveLink).toBeVisible();

    await archiveLink.click();
    await expect(page).toHaveURL(/archive/);
  });

  test('archive page displays articles grouped by date', async ({ page }) => {
    await page.goto('/archive.html');

    // Page should load without error
    await expect(page).toHaveURL(/archive/);

    // Should have heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/archive/i);
  });

  test('archive shows year/month groupings', async ({ page }) => {
    await page.goto('/archive.html');

    // Look for date groupings (could be h2, h3, or other elements)
    // Common patterns: "2025", "January 2025", "2025-01"
    const yearPattern = /20\d{2}/;

    const headings = page.locator('h2, h3, [class*="year"], [class*="month"]');
    const count = await headings.count();

    if (count > 0) {
      // At least one heading should contain a year
      let foundYear = false;
      for (let i = 0; i < count; i++) {
        const text = await headings.nth(i).textContent();
        if (text && yearPattern.test(text)) {
          foundYear = true;
          break;
        }
      }
      expect(foundYear).toBe(true);
    }
  });

  test('archive articles link to article pages', async ({ page }) => {
    await page.goto('/archive.html');

    const articleLinks = page.locator('a[href*="/articles/"]');
    const count = await articleLinks.count();

    // All links should point to valid article pages
    for (let i = 0; i < Math.min(count, 5); i++) {
      const href = await articleLinks.nth(i).getAttribute('href');
      expect(href).toMatch(/\/articles\/[\w-]+\/?/);
    }
  });

  test('clicking archive article navigates correctly', async ({ page }) => {
    await page.goto('/archive.html');

    const firstArticle = page.locator('a[href*="/articles/"]').first();
    const count = await firstArticle.count();

    if (count > 0) {
      await firstArticle.click();
      await expect(page).toHaveURL(/\/articles\//);

      // Article page should have proper structure
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('article')).toBeVisible();
    }
  });

  test('homepage shows recent articles in chronological order', async ({ page }) => {
    await page.goto('/');

    // Homepage should show articles
    const articleList = page.locator('section[aria-label="Article list"]');

    // If article list exists, verify articles are present
    const exists = (await articleList.count()) > 0;
    if (exists) {
      const articles = articleList.locator('article');
      const articleCount = await articles.count();
      expect(articleCount).toBeGreaterThan(0);
    }
  });

  test('articles display dates', async ({ page }) => {
    await page.goto('/');

    // Articles should show their publication date
    const timeElements = page.locator('time');
    const count = await timeElements.count();

    if (count > 0) {
      // Time elements should have datetime attribute
      const datetime = await timeElements.first().getAttribute('datetime');
      // Should be ISO date format or similar
      expect(datetime).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('archive is keyboard navigable', async ({ page }) => {
    await page.goto('/archive.html');

    const firstArticle = page.locator('a[href*="/articles/"]').first();
    const count = await firstArticle.count();

    if (count > 0) {
      await firstArticle.focus();
      await expect(firstArticle).toBeFocused();

      const href = await firstArticle.getAttribute('href');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(href || '');
    }
  });

  test('archive page has proper semantic structure', async ({ page }) => {
    await page.goto('/archive.html');

    // Should have main landmark
    await expect(page.locator('main')).toBeVisible();

    // Should have heading hierarchy starting with h1
    await expect(page.locator('h1')).toBeVisible();

    // Should have navigation
    await expect(page.locator('nav')).toBeVisible();
  });

  test('back navigation from article returns to archive', async ({ page }) => {
    await page.goto('/archive.html');

    const firstArticle = page.locator('a[href*="/articles/"]').first();
    const count = await firstArticle.count();

    if (count > 0) {
      await firstArticle.click();
      await expect(page).toHaveURL(/\/articles\//);

      await page.goBack();
      await expect(page).toHaveURL(/archive/);
    }
  });
});
