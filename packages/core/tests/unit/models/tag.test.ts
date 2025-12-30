import { describe, it, expect } from 'vitest';
import { createTag, normalizeTagSlug } from '../../../src/models/tag.js';

describe('Tag model', () => {
  describe('normalizeTagSlug', () => {
    it('should convert to lowercase', () => {
      expect(normalizeTagSlug('JavaScript')).toBe('javascript');
    });

    it('should replace spaces with hyphens', () => {
      expect(normalizeTagSlug('Machine Learning')).toBe('machine-learning');
    });

    it('should handle C++ special case', () => {
      expect(normalizeTagSlug('C++')).toBe('c-plus-plus');
    });

    it('should handle multiple plus signs', () => {
      expect(normalizeTagSlug('C+++++')).toBe('c-plus-plus-plus-plus-plus');
    });

    it('should remove special characters', () => {
      expect(normalizeTagSlug('Node.js')).toBe('nodejs');
    });

    it('should handle leading/trailing whitespace', () => {
      expect(normalizeTagSlug('  TypeScript  ')).toBe('typescript');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeTagSlug('Deep   Learning')).toBe('deep-learning');
    });

    it('should handle empty string', () => {
      expect(normalizeTagSlug('')).toBe('');
    });

    it('should handle numbers', () => {
      expect(normalizeTagSlug('ES2022')).toBe('es2022');
    });

    it('should handle ampersand', () => {
      expect(normalizeTagSlug('Tips & Tricks')).toBe('tips-tricks');
    });

    it('should handle unicode characters', () => {
      // Non-ASCII characters are removed
      expect(normalizeTagSlug('Résumé')).toBe('rsum');
    });
  });

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
  });
});
