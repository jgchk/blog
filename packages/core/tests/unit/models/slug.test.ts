import { describe, it, expect } from 'vitest';
import { Slug } from '../../../src/models/slug.js';

describe('Slug Value Object', () => {
  describe('Slug.create', () => {
    it('should create a slug from a valid input', () => {
      const slug = Slug.create('Hello World');
      expect(slug).not.toBeNull();
      expect(slug?.toString()).toBe('hello-world');
    });

    it('should return null for empty input', () => {
      const slug = Slug.create('');
      expect(slug).toBeNull();
    });

    it('should return null for whitespace-only input', () => {
      const slug = Slug.create('   ');
      expect(slug).toBeNull();
    });

    it('should return null for input that normalizes to empty string', () => {
      const slug = Slug.create('!!!');
      expect(slug).toBeNull();
    });

    it('should handle leading and trailing whitespace', () => {
      const slug = Slug.create('  Hello World  ');
      expect(slug?.toString()).toBe('hello-world');
    });
  });

  describe('Slug.normalize', () => {
    it('should convert to lowercase', () => {
      expect(Slug.normalize('JavaScript')).toBe('javascript');
    });

    it('should replace spaces with hyphens', () => {
      expect(Slug.normalize('Hello World')).toBe('hello-world');
    });

    it('should replace underscores with hyphens', () => {
      expect(Slug.normalize('hello_world')).toBe('hello-world');
    });

    it('should collapse multiple spaces', () => {
      expect(Slug.normalize('hello   world')).toBe('hello-world');
    });

    it('should collapse multiple hyphens', () => {
      expect(Slug.normalize('hello---world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(Slug.normalize('hello@world!')).toBe('helloworld');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(Slug.normalize('-hello-world-')).toBe('hello-world');
    });

    it('should handle numbers', () => {
      expect(Slug.normalize('ES2022')).toBe('es2022');
    });

    it('should handle mixed case with numbers', () => {
      expect(Slug.normalize('TypeScript 5')).toBe('typescript-5');
    });
  });

  describe('Slug.normalizeForMatching', () => {
    it('should normalize for cross-link matching', () => {
      expect(Slug.normalizeForMatching('Article B Title')).toBe('article-b-title');
    });

    it('should handle uppercase', () => {
      expect(Slug.normalizeForMatching('ARTICLE B TITLE')).toBe('article-b-title');
    });

    it('should handle underscores', () => {
      expect(Slug.normalizeForMatching('Article_B_Title')).toBe('article-b-title');
    });

    it('should handle hyphens', () => {
      expect(Slug.normalizeForMatching('Article-B-Title')).toBe('article-b-title');
    });
  });

  describe('Slug.fromNormalized', () => {
    it('should create slug from already normalized string', () => {
      const slug = Slug.fromNormalized('already-normalized');
      expect(slug.toString()).toBe('already-normalized');
    });

    it('should not re-normalize the input', () => {
      // Note: This bypasses normalization, so use with caution
      const slug = Slug.fromNormalized('NotNormalized');
      expect(slug.toString()).toBe('NotNormalized');
    });
  });

  describe('Slug instance methods', () => {
    describe('toString', () => {
      it('should return the string value', () => {
        const slug = Slug.create('Hello World');
        expect(slug?.toString()).toBe('hello-world');
      });
    });

    describe('valueOf', () => {
      it('should return the string value', () => {
        const slug = Slug.create('Hello World');
        expect(slug?.valueOf()).toBe('hello-world');
      });
    });

    describe('toJSON', () => {
      it('should serialize to string', () => {
        const slug = Slug.create('Hello World');
        expect(slug?.toJSON()).toBe('hello-world');
      });

      it('should work with JSON.stringify', () => {
        const slug = Slug.create('Hello World');
        const obj = { slug };
        expect(JSON.stringify(obj)).toBe('{"slug":"hello-world"}');
      });
    });

    describe('equals', () => {
      it('should compare with another Slug', () => {
        const slug1 = Slug.create('Hello World');
        const slug2 = Slug.create('hello-world');
        expect(slug1?.equals(slug2!)).toBe(true);
      });

      it('should compare with a string (normalizing it)', () => {
        const slug = Slug.create('Hello World');
        expect(slug?.equals('hello-world')).toBe(true);
        expect(slug?.equals('Hello World')).toBe(true);
      });

      it('should return false for non-matching slugs', () => {
        const slug1 = Slug.create('Hello');
        const slug2 = Slug.create('World');
        expect(slug1?.equals(slug2!)).toBe(false);
      });

      it('should return false for non-matching strings', () => {
        const slug = Slug.create('Hello');
        expect(slug?.equals('World')).toBe(false);
      });
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal value', () => {
      const slug = Slug.create('Hello World');
      // TypeScript prevents direct modification, but we can verify the value stays consistent
      expect(slug?.toString()).toBe('hello-world');
      expect(slug?.toString()).toBe('hello-world');
    });
  });
});
