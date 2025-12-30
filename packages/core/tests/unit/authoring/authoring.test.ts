import { describe, it, expect } from 'vitest';
import { FrontMatterParser, MarkdownParser } from '../../../src/authoring/index.js';

describe('Authoring Bounded Context', () => {
  describe('exports', () => {
    it('should export FrontMatterParser class', () => {
      expect(FrontMatterParser).toBeDefined();
      expect(typeof FrontMatterParser.prototype.parse).toBe('function');
    });

    it('should export MarkdownParser class', () => {
      expect(MarkdownParser).toBeDefined();
      expect(typeof MarkdownParser.prototype.parse).toBe('function');
    });
  });

  describe('FrontMatterParser', () => {
    it('should parse valid front matter', () => {
      const parser = new FrontMatterParser();
      const content = `---
title: Test Article
date: 2024-01-15
tags:
  - typescript
  - testing
---
# Hello World`;

      const result = parser.parse(content);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Article');
        expect(result.data.tags).toEqual(['typescript', 'testing']);
      }
    });
  });

  describe('MarkdownParser', () => {
    it('should parse markdown to HTML', async () => {
      const parser = new MarkdownParser();
      const result = await parser.parse('# Hello World');

      expect(result).toContain('<h1>Hello World</h1>');
    });
  });
});
