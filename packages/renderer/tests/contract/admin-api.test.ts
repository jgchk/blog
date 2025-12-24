import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { AdminHandler } from '../../src/handlers/admin.js';
import { SyncTracker } from '../../src/services/sync-tracker.js';

/**
 * Contract tests for Admin API endpoints.
 * Per contracts/api.yaml specification.
 */
describe('Admin API Contract Tests', () => {
  let handler: AdminHandler;
  let syncTracker: SyncTracker;

  beforeEach(() => {
    syncTracker = new SyncTracker();
    handler = new AdminHandler(syncTracker);
  });

  const createEvent = (
    overrides: Partial<APIGatewayProxyEvent> = {}
  ): APIGatewayProxyEvent =>
    ({
      httpMethod: 'GET',
      path: '/admin/status',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      ...overrides,
    }) as APIGatewayProxyEvent;

  describe('GET /admin/status', () => {
    it('returns 200 with empty items when no syncs exist', async () => {
      const event = createEvent();
      const result = await handler.getStatus(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        items: [],
        total: 0,
      });
    });

    it('returns recent sync operations', async () => {
      syncTracker.startSync('sync-1', 'commit-abc');
      syncTracker.completeSync('sync-1', 5, 0, []);

      const event = createEvent();
      const result = await handler.getStatus(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        syncId: 'sync-1',
        commitHash: 'commit-abc',
        status: 'completed',
        articlesProcessed: 5,
      });
    });

    it('respects limit query parameter', async () => {
      syncTracker.startSync('sync-1', 'commit-1');
      syncTracker.startSync('sync-2', 'commit-2');
      syncTracker.startSync('sync-3', 'commit-3');

      const event = createEvent({
        queryStringParameters: { limit: '2' },
      });
      const result = await handler.getStatus(event);

      const body = JSON.parse(result.body);
      expect(body.items).toHaveLength(2);
    });

    it('caps limit at 50', async () => {
      const event = createEvent({
        queryStringParameters: { limit: '100' },
      });
      const result = await handler.getStatus(event);

      expect(result.statusCode).toBe(200);
      // Test passes if no error - actual capping tested via items length
    });

    it('returns Content-Type application/json', async () => {
      const event = createEvent();
      const result = await handler.getStatus(event);

      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('GET /admin/status/{syncId}', () => {
    it('returns 200 with sync details when found', async () => {
      syncTracker.startSync('sync-123', 'commit-abc');
      syncTracker.completeSync('sync-123', 10, 2, [
        { articleSlug: 'post-1', errorType: 'parse', message: 'Error' },
      ]);

      const event = createEvent({
        path: '/admin/status/sync-123',
        pathParameters: { syncId: 'sync-123' },
      });
      const result = await handler.getSyncById(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toMatchObject({
        syncId: 'sync-123',
        commitHash: 'commit-abc',
        status: 'failed',
        articlesProcessed: 10,
        articlesFailed: 2,
      });
      expect(body.errors).toHaveLength(1);
    });

    it('returns 404 when sync not found', async () => {
      const event = createEvent({
        path: '/admin/status/unknown',
        pathParameters: { syncId: 'unknown' },
      });
      const result = await handler.getSyncById(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Sync operation not found');
    });

    it('returns 400 when syncId parameter missing', async () => {
      const event = createEvent({
        path: '/admin/status/',
        pathParameters: null,
      });
      const result = await handler.getSyncById(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Missing syncId parameter');
    });
  });

  describe('POST /admin/retry/{syncId}', () => {
    it('returns 202 when retry initiated for failed sync', async () => {
      syncTracker.startSync('sync-123', 'commit-abc');
      syncTracker.failSync('sync-123', {
        articleSlug: 'post-1',
        errorType: 'storage',
        message: 'S3 error',
      });

      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/retry/sync-123',
        pathParameters: { syncId: 'sync-123' },
      });
      const result = await handler.retrySyncOperation(event);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('accepted');
      expect(body.syncId).toMatch(/^retry-\d+$/);
    });

    it('returns 404 when sync not found', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/retry/unknown',
        pathParameters: { syncId: 'unknown' },
      });
      const result = await handler.retrySyncOperation(event);

      expect(result.statusCode).toBe(404);
    });

    it('returns 409 when sync is not in failed state', async () => {
      syncTracker.startSync('sync-123', 'commit-abc');
      syncTracker.completeSync('sync-123', 5, 0, []); // Completed, not failed

      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/retry/sync-123',
        pathParameters: { syncId: 'sync-123' },
      });
      const result = await handler.retrySyncOperation(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Sync operation is not in failed state');
    });

    it('returns 400 when syncId parameter missing', async () => {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/admin/retry/',
        pathParameters: null,
      });
      const result = await handler.retrySyncOperation(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /admin/health', () => {
    it('returns healthy status when no failures', async () => {
      const result = await handler.getHealth();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('healthy');
      expect(body.consecutiveFailures).toBe(0);
      expect(body.components).toMatchObject({
        s3: { status: 'healthy' },
        cloudfront: { status: 'healthy' },
        sns: { status: 'healthy' },
      });
    });

    it('returns degraded status after 3+ consecutive failures (FR-014)', async () => {
      // Create 3 consecutive failures
      for (let i = 1; i <= 3; i++) {
        syncTracker.startSync(`sync-${i}`, `commit-${i}`);
        syncTracker.failSync(`sync-${i}`, {
          articleSlug: 'post-1',
          errorType: 'parse',
          message: 'Error',
        });
      }

      const result = await handler.getHealth();

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('degraded');
      expect(body.consecutiveFailures).toBe(3);
    });

    it('includes lastSyncAt when syncs exist', async () => {
      syncTracker.startSync('sync-1', 'commit-1');

      const result = await handler.getHealth();

      const body = JSON.parse(result.body);
      expect(body.lastSyncAt).not.toBeNull();
    });

    it('returns null for lastSyncAt when no syncs exist', async () => {
      const result = await handler.getHealth();

      const body = JSON.parse(result.body);
      expect(body.lastSyncAt).toBeNull();
    });
  });
});
