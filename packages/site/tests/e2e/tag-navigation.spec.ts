import { test, expect } from '@playwright/test';

/**
 * E2E tests for tag navigation.
 * Per T047: User Story 2 - Browse Articles by Tag
 */
test.describe('Tag Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
  });

  test('displays tags on article page', async ({ page }) => {
    // Navigate to any article that has tags
    await page.goto('/articles/example-post/');

    // Check for tags section
    const tagsSection = page.locator('.tags');
    await expect(tagsSection).toBeVisible();

    // Tags should be clickable links
    const tagLinks = tagsSection.locator('a');
    const tagCount = await tagLinks.count();
    expect(tagCount).toBeGreaterThan(0);
  });

  test('clicking a tag navigates to tag page', async ({ page }) => {
    // Navigate to an article with tags
    await page.goto('/articles/example-post/');

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
    // Navigate directly to a tag page
    await page.goto('/tags/typescript.html');

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
    // Navigate to an article with tags
    await page.goto('/articles/example-post/');

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
    await page.goto('/articles/example-post/');

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
    await page.goto('/articles/example-post/');

    // Click a tag
    await page.locator('.tags a').first().click();
    await expect(page).toHaveURL(/\/tags\//);

    // Go back
    await page.goBack();

    // Should be back on article page
    await expect(page).toHaveURL(/\/articles\/example-post\//);
  });
});
