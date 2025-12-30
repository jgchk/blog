/**
 * @deprecated Import from bounded contexts instead:
 * - '@blog/core/authoring' for FrontMatter, ValidationError
 * - '@blog/core/publishing' for Article, Tag, Slug
 * - '@blog/core/linking' for CrossLink
 */

// Re-export from authoring
export type { FrontMatter } from '../authoring/front-matter.js';
export { isFrontMatter } from '../authoring/front-matter.js';
export type { ValidationError } from '../authoring/validation-error.js';
export { formatValidationError, isRecoverableError } from '../authoring/validation-error.js';

// Re-export from publishing
export type { Article, ParsedArticle } from '../publishing/article.js';
export type { Tag, TagWithStats } from '../publishing/tag.js';
export { createTag } from '../publishing/tag.js';
export { Slug } from '../publishing/slug.js';

// Re-export from linking
export type { CrossLink, CrossLinkResolution } from '../linking/cross-link.js';

// Sync status stays in infrastructure
export type { SyncStatus, SyncError } from './sync-status.js';
export { createSyncStatus } from './sync-status.js';
