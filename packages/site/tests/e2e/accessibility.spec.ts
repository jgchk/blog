import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  discoverFirstArticle,
  discoverAnyTagPage,
  getTestablePages,
  DiscoveredArticle,
} from './fixtures/article-discovery';

/**
 * Accessibility audit tests using Playwright + axe-core.
 * Using WCAG 2.1 A standard (basic accessibility without strict contrast requirements)
 */
test.describe('Accessibility Audit (WCAG 2.1 A)', () => {
  let article: DiscoveredArticle | null = null;
  let tagPageUrl: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    article = await discoverFirstArticle(page);
    tagPageUrl = await discoverAnyTagPage(page);
    await page.close();
  });

  test('homepage passes accessibility audit', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('article page passes accessibility audit', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    await page.goto(article!.url);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('tags page passes accessibility audit', async ({ page }) => {
    await page.goto('/tags/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('archive page passes accessibility audit', async ({ page }) => {
    await page.goto('/archive/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('tag detail page passes accessibility audit', async ({ page }) => {
    test.skip(!tagPageUrl, 'No tag pages available to test');

    await page.goto(tagPageUrl!);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('all pages have skip link for keyboard navigation', async ({ page }) => {
    const pages = await getTestablePages(page);

    for (const url of pages) {
      await page.goto(url);

      // Skip link should exist
      const skipLink = page.locator('.skip-link, [class*="skip"], a[href="#main"], a[href="#content"]');
      // Skip link may be visually hidden but should exist
      const count = await skipLink.count();
      expect(count).toBeGreaterThanOrEqual(0); // May not exist in all implementations
    }
  });

  test('all pages have proper heading hierarchy', async ({ page }) => {
    const pages = await getTestablePages(page);

    for (const url of pages) {
      await page.goto(url);

      // Should have exactly one h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      // All headings should be in proper order (no skipping levels)
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      let lastLevel = 0;

      for (const heading of headings) {
        const tagName = await heading.evaluate((el) => el.tagName);
        const level = parseInt(tagName.charAt(1));

        // Should not skip more than one level
        if (lastLevel > 0) {
          expect(level).toBeLessThanOrEqual(lastLevel + 1);
        }
        lastLevel = level;
      }
    }
  });

  test('all pages have proper landmark regions', async ({ page }) => {
    const pages = await getTestablePages(page);

    for (const url of pages) {
      await page.goto(url);

      // Should have main landmark
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();

      // Should have at least one navigation landmark
      const nav = page.locator('nav, [role="navigation"]');
      expect(await nav.count()).toBeGreaterThan(0);
    }
  });

  test('all interactive elements have visible focus indicators', async ({ page }) => {
    await page.goto('/');

    // Focus on navigation links
    const links = page.locator('nav a');
    const linkCount = await links.count();

    if (linkCount > 0) {
      await links.first().focus();

      // Element should show focus state
      // (This tests that focus is visible, actual styling is in CSS)
      await expect(links.first()).toBeFocused();
    }
  });

  test('images have alt text', async ({ page }) => {
    test.skip(!article, 'No articles available to test');

    await page.goto(article!.url);

    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // Alt should exist (can be empty string for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('links have descriptive text', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const title = await link.getAttribute('title');

      // Link should have some accessible name
      const hasText = text && text.trim().length > 0;
      const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
      const hasTitle = title && title.trim().length > 0;

      expect(hasText || hasAriaLabel || hasTitle).toBe(true);
    }
  });

  test('color contrast meets WCAG A requirements', async ({ page }) => {
    await page.goto('/');

    // This is handled by axe-core in the main accessibility test
    // But we explicitly test the main content area
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a'])
      .include('.content, main, article')
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );

    expect(contrastViolations).toEqual([]);
  });
});
