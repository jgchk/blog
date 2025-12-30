import { describe, it, expect } from 'vitest';
import { formatDate, formatDateISO, formatMonthYear } from '../../../src/utils/date-format.js';

describe('Date Formatting Utilities', () => {
  describe('formatDate', () => {
    it('should format a date as "Month Day, Year"', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(formatDate(date)).toBe('January 15, 2025');
    });

    it('should preserve the intended date regardless of local timezone', () => {
      // When parsing a date string without time (e.g., from frontmatter "date: 2025-12-23"),
      // JavaScript interprets it as midnight UTC. Without UTC timezone in formatting,
      // this would display as December 22 in US timezones (UTC-5 to UTC-8).
      const date = new Date('2025-12-23T00:00:00.000Z');
      expect(formatDate(date)).toBe('December 23, 2025');
    });

    it('should handle dates parsed from date-only strings (frontmatter format)', () => {
      // This simulates how dates are parsed from frontmatter: "date: 2025-06-15"
      // JavaScript parses this as midnight UTC
      const date = new Date('2025-06-15');
      expect(formatDate(date)).toBe('June 15, 2025');
    });

    it('should handle year boundaries correctly', () => {
      // Midnight UTC on January 1st would be December 31st in US timezones without UTC
      const date = new Date('2025-01-01T00:00:00.000Z');
      expect(formatDate(date)).toBe('January 1, 2025');
    });
  });

  describe('formatDateISO', () => {
    it('should format a date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(formatDateISO(date)).toBe('2025-01-15');
    });

    it('should preserve the UTC date', () => {
      const date = new Date('2025-12-23T00:00:00.000Z');
      expect(formatDateISO(date)).toBe('2025-12-23');
    });
  });

  describe('formatMonthYear', () => {
    it('should format a date as "Month Year"', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(formatMonthYear(date)).toBe('January 2025');
    });

    it('should preserve the intended month regardless of local timezone', () => {
      // Midnight UTC on January 1st would show as December in US timezones without UTC
      const date = new Date('2025-01-01T00:00:00.000Z');
      expect(formatMonthYear(date)).toBe('January 2025');
    });

    it('should handle dates parsed from date-only strings (frontmatter format)', () => {
      const date = new Date('2025-01-15');
      expect(formatMonthYear(date)).toBe('January 2025');
    });
  });
});
