import { describe, it, expect } from 'vitest';
import { normalizeTagSlug } from '../../../src/models/tag.js';

describe('Tag slug utilities', () => {
  describe('normalizeTagSlug special character handling', () => {
    it('should handle spaces → hyphens', () => {
      expect(normalizeTagSlug('Web Development')).toBe('web-development');
    });

    it('should handle periods → removed', () => {
      expect(normalizeTagSlug('Node.js')).toBe('nodejs');
    });

    it('should handle slashes → removed', () => {
      expect(normalizeTagSlug('HTML/CSS')).toBe('htmlcss');
    });

    it('should handle hash → removed', () => {
      expect(normalizeTagSlug('C#')).toBe('c');
    });

    it('should handle at symbol → removed', () => {
      expect(normalizeTagSlug('@types')).toBe('types');
    });

    it('should handle parentheses → removed', () => {
      expect(normalizeTagSlug('React (JavaScript)')).toBe('react-javascript');
    });

    it('should handle brackets → removed', () => {
      expect(normalizeTagSlug('ES[2022]')).toBe('es2022');
    });

    it('should handle colons → removed', () => {
      expect(normalizeTagSlug('TypeScript: Advanced')).toBe('typescript-advanced');
    });

    it('should handle quotes → removed', () => {
      expect(normalizeTagSlug("It's TypeScript")).toBe('its-typescript');
    });

    it('should handle multiple consecutive special chars', () => {
      // Periods are removed, hyphens normalized, spaces become hyphens
      expect(normalizeTagSlug('A...B---C   D')).toBe('ab-c-d');
    });

    it('should not have leading or trailing hyphens', () => {
      expect(normalizeTagSlug('---TypeScript---')).toBe('typescript');
    });

    it('should handle emoji → removed', () => {
      const result = normalizeTagSlug('🚀 Deployment');
      expect(result).toBe('deployment');
    });
  });

  describe('edge cases', () => {
    it('should handle only special characters', () => {
      expect(normalizeTagSlug('!@#$%')).toBe('');
    });

    it('should handle only spaces', () => {
      expect(normalizeTagSlug('     ')).toBe('');
    });

    it('should handle very long tag names', () => {
      const longTag = 'A'.repeat(100);
      const result = normalizeTagSlug(longTag);
      expect(result).toBe('a'.repeat(100));
    });

    it('should handle mixed case and special chars', () => {
      expect(normalizeTagSlug('TypeScript + JavaScript = Love')).toBe('typescript-plus-javascript-love');
    });
  });
});
