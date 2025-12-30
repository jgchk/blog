import { describe, it, expect } from 'vitest';
import { createTag } from '../../../src/publishing/tag.js';

describe('Tag model', () => {
  describe('createTag', () => {
    it('should create tag with normalized slug', () => {
      const tag = createTag('Machine Learning');

      expect(tag.slug).toBe('machine-learning');
      expect(tag.name).toBe('Machine Learning');
      // Tag is now an immutable Value Object without count/articles
      // Use TagIndex.getTagWithStats() to get statistics
    });

    it('should preserve original casing in name', () => {
      const tag = createTag('TypeScript');

      expect(tag.slug).toBe('typescript');
      expect(tag.name).toBe('TypeScript');
    });

    it('should be immutable (readonly properties)', () => {
      const tag = createTag('JavaScript');

      // TypeScript enforces readonly at compile time
      // At runtime we verify the object has the expected shape
      expect(Object.keys(tag)).toEqual(['slug', 'name']);
    });

    it('should handle C++ special case via Slug.normalizeTag', () => {
      const tag = createTag('C++');

      expect(tag.slug).toBe('c-plus-plus');
      expect(tag.name).toBe('C++');
    });
  });
});
