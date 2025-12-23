/**
 * Date formatting utilities for display.
 */

/**
 * Format a date for human-readable display
 * @example formatDate(new Date('2025-01-15')) // "January 15, 2025"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date for ISO string (YYYY-MM-DD)
 * @example formatDateISO(new Date('2025-01-15')) // "2025-01-15"
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Format a date for month-year display
 * @example formatMonthYear(new Date('2025-01-15')) // "January 2025"
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
