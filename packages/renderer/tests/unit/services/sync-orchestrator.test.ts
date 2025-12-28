import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StorageAdapter, NotificationAdapter, Article } from '@blog/core';
import type { RepositoryRef } from '../../../src/adapters/github-content.js';

// Mock types for testing
interface MockGitHubContentFetcher {
  fetchFile: ReturnType<typeof vi.fn>;
  listDirectory: ReturnType<typeof vi.fn>;
  listPostSlugs: ReturnType<typeof vi.fn>;
  fetchPostFiles: ReturnType<typeof vi.fn>;
}

interface MockRenderService {
  renderArticle: ReturnType<typeof vi.fn>;
  publishArticle: ReturnType<typeof vi.fn>;
  publishArticleWithRetry: ReturnType<typeof vi.fn>;
  copyAssets: ReturnType<typeof vi.fn>;
  copyAssetsWithRetry: ReturnType<typeof vi.fn>;
  publishAllTagsPage: ReturnType<typeof vi.fn>;
  publishAllTagPages: ReturnType<typeof vi.fn>;
}

interface MockSyncTracker {
  startSync: ReturnType<typeof vi.fn>;
  completeSync: ReturnType<typeof vi.fn>;
  failSync: ReturnType<typeof vi.fn>;
  getSync: ReturnType<typeof vi.fn>;
  getRecentSyncs: ReturnType<typeof vi.fn>;
}

interface MockCloudFrontInvalidator {
  createInvalidation: ReturnType<typeof vi.fn>;
}

// We'll import SyncOrchestrator once it's created
// For now, test the expected behavior

describe('SyncOrchestrator', () => {
  let mockContentFetcher: MockGitHubContentFetcher;
  let mockStorage: StorageAdapter;
  let mockNotifier: NotificationAdapter;
  let mockRenderService: MockRenderService;
  let mockSyncTracker: MockSyncTracker;
  let mockCloudFront: MockCloudFrontInvalidator;

  const testRepo: RepositoryRef = {
    owner: 'test-owner',
    name: 'test-repo',
    ref: 'main',
  };

  beforeEach(() => {
    mockContentFetcher = {
      fetchFile: vi.fn(),
      listDirectory: vi.fn(),
      listPostSlugs: vi.fn(),
      fetchPostFiles: vi.fn(),
    };

    mockStorage = {
      read: vi.fn(),
      write: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      exists: vi.fn(),
    };

    mockNotifier = {
      send: vi.fn(),
    };

    mockRenderService = {
      renderArticle: vi.fn(),
      publishArticle: vi.fn(),
      publishArticleWithRetry: vi.fn(),
      copyAssets: vi.fn(),
      copyAssetsWithRetry: vi.fn(),
      publishAllTagsPage: vi.fn(),
      publishAllTagPages: vi.fn(),
    };

    mockSyncTracker = {
      startSync: vi.fn().mockReturnValue({
        syncId: 'test-sync-id',
        commitHash: 'abc123',
        status: 'in_progress',
        articlesProcessed: 0,
        articlesFailed: 0,
        errors: [],
        consecutiveFailures: 0,
        startedAt: new Date(),
        completedAt: null,
      }),
      completeSync: vi.fn().mockReturnValue({
        syncId: 'test-sync-id',
        status: 'completed',
      }),
      failSync: vi.fn(),
      getSync: vi.fn(),
      getRecentSyncs: vi.fn().mockReturnValue([]),
    };

    mockCloudFront = {
      createInvalidation: vi.fn(),
    };
  });

  describe('constructor and dependency injection', () => {
    it('should accept all required dependencies', async () => {
      // This test will verify the constructor signature once implemented
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      expect(orchestrator).toBeDefined();
    });
  });

  describe('isSyncInProgress', () => {
    it('should return false when no sync is running', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      expect(orchestrator.isSyncInProgress()).toBe(false);
    });
  });

  describe('getCurrentSync', () => {
    it('should return null when no sync is running', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      expect(orchestrator.getCurrentSync()).toBeNull();
    });
  });

  describe('syncId generation and status tracking', () => {
    it('should generate unique syncId for each sync operation', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      // Setup minimal mocks for sync to complete
      mockContentFetcher.fetchPostFiles.mockResolvedValue([
        {
          path: 'posts/test-post/index.md',
          content: Buffer.from('---\ntitle: Test\ndate: 2024-01-01\n---\n# Test'),
          size: 50,
        },
      ]);

      mockRenderService.renderArticle.mockResolvedValue({
        success: true,
        article: {
          slug: 'test-post',
          title: 'Test',
          date: new Date('2024-01-01'),
          content: '# Test',
          html: '<h1>Test</h1>',
          tags: [],
          aliases: [],
          draft: false,
          excerpt: 'Test',
          sourcePath: 'posts/test-post/index.md',
          updatedAt: new Date(),
        } as Article,
      });

      mockRenderService.publishArticleWithRetry.mockResolvedValue({
        success: true,
        attempts: 1,
      });

      mockRenderService.copyAssetsWithRetry.mockResolvedValue({
        success: true,
        result: { copied: [], failed: [] },
        attempts: 1,
      });

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      const result = await orchestrator.sync({
        type: 'incremental',
        repository: testRepo,
        changes: {
          added: ['posts/test-post/index.md'],
          modified: [],
          removed: [],
        },
      });

      expect(result.syncId).toBeDefined();
      expect(result.syncId).toMatch(/^sync-\d+-[a-f0-9]+$/);
      expect(mockSyncTracker.startSync).toHaveBeenCalled();
    });

    it('should track status transitions through pending/running/completed', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      mockContentFetcher.fetchPostFiles.mockResolvedValue([]);

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      await orchestrator.sync({
        type: 'incremental',
        repository: testRepo,
        changes: {
          added: [],
          modified: [],
          removed: [],
        },
      });

      // Verify startSync was called (status: in_progress)
      expect(mockSyncTracker.startSync).toHaveBeenCalled();
      // Verify completeSync was called (status: completed)
      expect(mockSyncTracker.completeSync).toHaveBeenCalled();
    });

    it('should track status as failed when errors occur', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      mockContentFetcher.fetchPostFiles.mockRejectedValue(new Error('GitHub API error'));
      mockSyncTracker.failSync.mockReturnValue({
        syncId: 'test-sync-id',
        status: 'failed',
      });

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      const result = await orchestrator.sync({
        type: 'incremental',
        repository: testRepo,
        changes: {
          added: ['posts/test-post/index.md'],
          modified: [],
          removed: [],
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('affected files list tracking', () => {
    it('should track list of files affected by sync operation', async () => {
      const { SyncOrchestrator } = await import('../../../src/services/sync-orchestrator.js');

      mockContentFetcher.fetchPostFiles.mockResolvedValue([
        {
          path: 'posts/post-1/index.md',
          content: Buffer.from('---\ntitle: Post 1\ndate: 2024-01-01\n---\n# Post 1'),
          size: 50,
        },
      ]);

      mockRenderService.renderArticle.mockResolvedValue({
        success: true,
        article: {
          slug: 'post-1',
          title: 'Post 1',
          date: new Date('2024-01-01'),
          content: '# Post 1',
          html: '<h1>Post 1</h1>',
          tags: [],
          aliases: [],
          draft: false,
          excerpt: 'Post 1',
          sourcePath: 'posts/post-1/index.md',
          updatedAt: new Date(),
        } as Article,
      });

      mockRenderService.publishArticleWithRetry.mockResolvedValue({
        success: true,
        attempts: 1,
      });

      mockRenderService.copyAssetsWithRetry.mockResolvedValue({
        success: true,
        result: { copied: [], failed: [] },
        attempts: 1,
      });

      const orchestrator = new SyncOrchestrator({
        contentFetcher: mockContentFetcher,
        storage: mockStorage,
        notifier: mockNotifier,
        renderService: mockRenderService,
        syncTracker: mockSyncTracker,
        distributionId: 'test-distribution-id',
        cloudFront: mockCloudFront,
      });

      const result = await orchestrator.sync({
        type: 'incremental',
        repository: testRepo,
        changes: {
          added: ['posts/post-1/index.md'],
          modified: [],
          removed: [],
        },
      });

      expect(result.articlesRendered).toContain('post-1');
    });
  });
});
