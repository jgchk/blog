import { describe, it, expect, beforeEach } from 'vitest';
import { RenderCache } from '../../src/state/render-cache.js';

describe('RenderCache', () => {
  let cache: RenderCache;

  beforeEach(() => {
    cache = new RenderCache();
  });

  describe('indexHtml', () => {
    it('should start empty', () => {
      expect(cache.indexHtml).toBe('');
    });

    it('should store index HTML', () => {
      cache.setIndex('<html>Index</html>');

      expect(cache.indexHtml).toBe('<html>Index</html>');
    });
  });

  describe('archiveHtml', () => {
    it('should start empty', () => {
      expect(cache.archiveHtml).toBe('');
    });

    it('should store archive HTML', () => {
      cache.setArchive('<html>Archive</html>');

      expect(cache.archiveHtml).toBe('<html>Archive</html>');
    });
  });

  describe('allTagsHtml', () => {
    it('should start empty', () => {
      expect(cache.allTagsHtml).toBe('');
    });

    it('should store all tags HTML', () => {
      cache.setAllTags('<html>All Tags</html>');

      expect(cache.allTagsHtml).toBe('<html>All Tags</html>');
    });
  });

  describe('tagPages', () => {
    it('should return undefined for non-existent tag', () => {
      expect(cache.getTagPage('javascript')).toBeUndefined();
    });

    it('should store and retrieve tag page', () => {
      cache.setTagPage('javascript', '<html>JavaScript</html>');

      expect(cache.getTagPage('javascript')).toBe('<html>JavaScript</html>');
    });

    it('should store multiple tag pages', () => {
      cache.setTagPage('javascript', '<html>JavaScript</html>');
      cache.setTagPage('typescript', '<html>TypeScript</html>');

      expect(cache.getTagPage('javascript')).toBe('<html>JavaScript</html>');
      expect(cache.getTagPage('typescript')).toBe('<html>TypeScript</html>');
    });

    it('should update existing tag page', () => {
      cache.setTagPage('javascript', '<html>Old</html>');
      cache.setTagPage('javascript', '<html>New</html>');

      expect(cache.getTagPage('javascript')).toBe('<html>New</html>');
    });

    it('should return all tag slugs', () => {
      cache.setTagPage('javascript', '<html>JavaScript</html>');
      cache.setTagPage('typescript', '<html>TypeScript</html>');

      const slugs = cache.getTagSlugs();

      expect(slugs).toHaveLength(2);
      expect(slugs).toContain('javascript');
      expect(slugs).toContain('typescript');
    });

    it('should return empty array when no tag pages', () => {
      expect(cache.getTagSlugs()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all cached HTML', () => {
      cache.setIndex('<html>Index</html>');
      cache.setArchive('<html>Archive</html>');
      cache.setAllTags('<html>All Tags</html>');
      cache.setTagPage('javascript', '<html>JavaScript</html>');

      cache.clear();

      expect(cache.indexHtml).toBe('');
      expect(cache.archiveHtml).toBe('');
      expect(cache.allTagsHtml).toBe('');
      expect(cache.getTagPage('javascript')).toBeUndefined();
    });
  });

  describe('hasContent', () => {
    it('should return false when empty', () => {
      expect(cache.hasContent()).toBe(false);
    });

    it('should return true when index is set', () => {
      cache.setIndex('<html>Index</html>');

      expect(cache.hasContent()).toBe(true);
    });

    it('should return true when archive is set', () => {
      cache.setArchive('<html>Archive</html>');

      expect(cache.hasContent()).toBe(true);
    });

    it('should return true when tag pages exist', () => {
      cache.setTagPage('javascript', '<html>JavaScript</html>');

      expect(cache.hasContent()).toBe(true);
    });
  });
});
