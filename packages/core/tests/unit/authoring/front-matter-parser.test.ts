import { describe, it, expect } from 'vitest';
import { FrontMatterParser } from '../../../src/authoring/front-matter-parser.js';

describe('FrontMatterParser', () => {
  const parser = new FrontMatterParser();

  describe('parse', () => {
    it('should parse valid front matter with all fields', () => {
      const markdown = `---
title: My Test Article
date: 2025-01-15
tags:
  - TypeScript
  - Testing
aliases:
  - Test Article
draft: false
excerpt: Custom excerpt
---

# Content here`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('My Test Article');
        expect(result.data.date).toBe('2025-01-15');
        expect(result.data.tags).toEqual(['TypeScript', 'Testing']);
        expect(result.data.aliases).toEqual(['Test Article']);
        expect(result.data.draft).toBe(false);
        expect(result.data.excerpt).toBe('Custom excerpt');
        expect(result.content).toBe('\n# Content here');
      }
    });

    it('should parse front matter with only required fields', () => {
      const markdown = `---
title: Minimal Article
date: 2025-01-15
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Minimal Article');
        expect(result.data.date).toBe('2025-01-15');
        expect(result.data.tags).toBeUndefined();
        expect(result.data.aliases).toBeUndefined();
        expect(result.data.draft).toBeUndefined();
      }
    });

    it('should return error for missing title', () => {
      const markdown = `---
date: 2025-01-15
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_title');
      }
    });

    it('should return error for missing date', () => {
      const markdown = `---
title: No Date Article
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_date');
      }
    });

    it('should return error for invalid YAML syntax', () => {
      const markdown = `---
title: Bad YAML
date: 2025-01-15
tags: [unclosed bracket
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('invalid_yaml');
      }
    });

    it('should return error for invalid date format', () => {
      const markdown = `---
title: Invalid Date
date: January 15, 2025
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('invalid_date');
      }
    });

    it('should handle empty tags array', () => {
      const markdown = `---
title: No Tags
date: 2025-01-15
tags: []
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
      }
    });

    it('should handle draft: true', () => {
      const markdown = `---
title: Draft Article
date: 2025-01-15
draft: true
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.draft).toBe(true);
      }
    });

    it('should handle content without front matter', () => {
      const markdown = `# No Front Matter

Just content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_title');
      }
    });

    it('should handle empty string title as missing', () => {
      const markdown = `---
title: ""
date: 2025-01-15
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_title');
      }
    });

    it('should handle non-string title as invalid', () => {
      const markdown = `---
title: 123
date: 2025-01-15
---

Content`;

      const result = parser.parse(markdown);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('missing_title');
      }
    });
  });
});
