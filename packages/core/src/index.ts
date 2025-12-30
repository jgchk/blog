// Bounded Contexts - primary exports organized by domain
// Import directly from bounded context subpaths:
// - import { FrontMatterParser } from '@blog/core/authoring'
// - import { ArticleValidator } from '@blog/core/publishing'
// - import { CrossLinkResolver } from '@blog/core/linking'

// Re-export everything from bounded contexts for backward compatibility
export * from './authoring/index.js';
export * from './publishing/index.js';
export * from './linking/index.js';

// Infrastructure - adapters and shared utilities
export * from './interfaces/index.js';
export * from './utils/index.js';

// Namespace exports for explicit bounded context access
export * as authoring from './authoring/index.js';
export * as publishing from './publishing/index.js';
export * as linking from './linking/index.js';
