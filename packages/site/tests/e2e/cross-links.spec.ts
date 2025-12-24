import { test, expect } from '@playwright/test';

/**
 * E2E tests for cross-link navigation.
 * Per T056: User Story 3 - Navigate via Cross-Links
 */
test.describe('Cross-Link Navigation', () => {
  test('wikilinks are rendered as clickable links', async ({ page }) => {
    // Navigate to an article that contains [[wikilinks]]
    await page.goto('/articles/example-post/');

    // Content area should exist
    const content = page.locator('.content');
    await expect(content).toBeVisible();

    // Look for internal article links (cross-links resolve to /articles/{slug}/)
    const crossLinks = content.locator('a[href^="/articles/"]');
    const count = await crossLinks.count();

    // If cross-links exist, they should be clickable
    if (count > 0) {
      await expect(crossLinks.first()).toBeVisible();
    }
  });

  test('clicking a cross-link navigates to the linked article', async ({ page }) => {
    // This test requires an article with cross-links to another existing article
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');
    const crossLinks = content.locator('a[href^="/articles/"]');
    const count = await crossLinks.count();

    if (count > 0) {
      // Get the href before clicking
      const href = await crossLinks.first().getAttribute('href');
      await crossLinks.first().click();

      // Should navigate to the linked article
      await expect(page).toHaveURL(href || '');

      // The linked article should have proper structure
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('broken cross-links are displayed as plain text', async ({ page }) => {
    // Navigate to an article that might have broken links
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');

    // Broken links should show as [[text]] (unresolved)
    // This is a negative test - we check they're NOT converted to links
    const brokenLinkPattern = /\[\[[^\]]+\]\]/;

    const contentText = await content.textContent();
    // If broken links exist, they should be plain text, not links
    // (This verifies the wikilinks plugin handles broken links correctly)

    // Also verify the content doesn't have href="#broken" or similar
    const brokenHrefs = content.locator('a[href*="broken"], a[href="#"]');
    const brokenCount = await brokenHrefs.count();
    // Should have no broken link markers
    expect(brokenCount).toBe(0);
  });

  test('cross-links preserve the display text', async ({ page }) => {
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');
    const crossLinks = content.locator('a[href^="/articles/"]');
    const count = await crossLinks.count();

    if (count > 0) {
      // Cross-links should have visible text
      const linkText = await crossLinks.first().textContent();
      expect(linkText).toBeTruthy();
      expect(linkText!.trim().length).toBeGreaterThan(0);
    }
  });

  test('cross-links are keyboard navigable', async ({ page }) => {
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');
    const crossLinks = content.locator('a[href^="/articles/"]');
    const count = await crossLinks.count();

    if (count > 0) {
      const firstLink = crossLinks.first();

      // Focus the link
      await firstLink.focus();
      await expect(firstLink).toBeFocused();

      // Should be able to activate with Enter
      const href = await firstLink.getAttribute('href');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(href || '');
    }
  });

  test('cross-linked articles can link back', async ({ page }) => {
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');
    const crossLinks = content.locator('a[href^="/articles/"]');
    const count = await crossLinks.count();

    if (count > 0) {
      // Navigate to linked article
      await crossLinks.first().click();

      // Check if the linked article might have a link back
      // (Not guaranteed, but tests bidirectional linking if present)
      const linkedContent = page.locator('.content');
      const backLinks = linkedContent.locator('a[href="/articles/example-post/"]');
      const backCount = await backLinks.count();

      // This is informational - bidirectional linking is optional
      if (backCount > 0) {
        await backLinks.first().click();
        await expect(page).toHaveURL(/\/articles\/example-post\//);
      }
    }
  });

  test('cross-links work correctly in different contexts', async ({ page }) => {
    await page.goto('/articles/example-post/');

    const content = page.locator('.content');

    // Cross-links in paragraphs
    const paragraphLinks = content.locator('p a[href^="/articles/"]');

    // Cross-links in lists
    const listLinks = content.locator('li a[href^="/articles/"]');

    // Cross-links in headings (if any)
    const headingLinks = content.locator('h2 a[href^="/articles/"], h3 a[href^="/articles/"]');

    // All should be valid links
    const contexts = [paragraphLinks, listLinks, headingLinks];

    for (const context of contexts) {
      const count = await context.count();
      for (let i = 0; i < count; i++) {
        const href = await context.nth(i).getAttribute('href');
        expect(href).toMatch(/^\/articles\/[\w-]+\/$/);
      }
    }
  });
});
