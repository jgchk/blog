import { describe, it, expect } from 'vitest';
import { MarkdownParser } from '../../../src/services/markdown-parser.js';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  describe('parse', () => {
    it('should convert markdown to HTML', async () => {
      const markdown = '# Hello World';
      const result = await parser.parse(markdown);

      expect(result).toContain('<h1>');
      expect(result).toContain('Hello World');
      expect(result).toContain('</h1>');
    });

    it('should support GitHub Flavored Markdown tables', async () => {
      const markdown = `
| Name | Age |
|------|-----|
| John | 30  |
`;
      const result = await parser.parse(markdown);

      expect(result).toContain('<table>');
      expect(result).toContain('<th>');
      expect(result).toContain('John');
    });

    it('should support GFM strikethrough', async () => {
      const markdown = '~~deleted~~';
      const result = await parser.parse(markdown);

      expect(result).toContain('<del>');
      expect(result).toContain('deleted');
    });

    it('should support GFM task lists', async () => {
      const markdown = `
- [x] Done
- [ ] Todo
`;
      const result = await parser.parse(markdown);

      expect(result).toContain('type="checkbox"');
      expect(result).toContain('checked');
    });

    it('should highlight code blocks', async () => {
      const markdown = `
\`\`\`typescript
const x: string = "hello";
\`\`\`
`;
      const result = await parser.parse(markdown);

      expect(result).toContain('<code');
      expect(result).toContain('language-typescript');
    });

    it('should handle inline code', async () => {
      const markdown = 'Use `const` for constants';
      const result = await parser.parse(markdown);

      expect(result).toContain('<code>');
      expect(result).toContain('const');
    });

    it('should handle links', async () => {
      const markdown = '[Link](https://example.com)';
      const result = await parser.parse(markdown);

      expect(result).toContain('<a');
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Link');
    });

    it('should handle images', async () => {
      const markdown = '![Alt text](./image.png)';
      const result = await parser.parse(markdown);

      expect(result).toContain('<img');
      expect(result).toContain('alt="Alt text"');
      expect(result).toContain('src="./image.png"');
    });

    it('should handle nested lists', async () => {
      const markdown = `
- Item 1
  - Nested 1
  - Nested 2
- Item 2
`;
      const result = await parser.parse(markdown);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
      expect(result).toContain('Nested 1');
    });

    it('should handle blockquotes', async () => {
      const markdown = '> This is a quote';
      const result = await parser.parse(markdown);

      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
    });

    it('should handle empty input', async () => {
      const result = await parser.parse('');
      expect(result).toBe('');
    });
  });

  describe('generateExcerpt', () => {
    it('should generate excerpt from content', () => {
      const content = 'This is a test article with some content.';
      const result = parser.generateExcerpt(content, 20);

      expect(result).toBe('This is a test artic...');
    });

    it('should not add ellipsis if content is shorter than limit', () => {
      const content = 'Short';
      const result = parser.generateExcerpt(content, 20);

      expect(result).toBe('Short');
    });

    it('should strip markdown formatting', () => {
      const content = '# Heading\n\n**Bold** and *italic* text';
      const result = parser.generateExcerpt(content, 50);

      expect(result).not.toContain('#');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
    });

    it('should use default length of 160 characters', () => {
      const content = 'a'.repeat(200);
      const result = parser.generateExcerpt(content);

      expect(result.length).toBe(163); // 160 + "..."
    });
  });
});
