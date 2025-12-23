import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SyncTracker } from '../services/sync-tracker.js';

/**
 * Admin API handlers.
 * Per contracts/api.yaml specification.
 */
export class AdminHandler {
  private syncTracker: SyncTracker;

  constructor(syncTracker: SyncTracker) {
    this.syncTracker = syncTracker;
  }

  /**
   * GET /admin/status - Get recent sync operations
   */
  async getStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const limit = parseInt(event.queryStringParameters?.limit ?? '10', 10);
    const syncs = this.syncTracker.getRecentSyncs(Math.min(limit, 50));

    return this.jsonResponse(200, {
      items: syncs,
      total: syncs.length,
    });
  }

  /**
   * GET /admin/status/{syncId} - Get specific sync operation
   */
  async getSyncById(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const syncId = event.pathParameters?.syncId;
    if (!syncId) {
      return this.errorResponse(400, 'Missing syncId parameter');
    }

    const sync = this.syncTracker.getSync(syncId);
    if (!sync) {
      return this.errorResponse(404, 'Sync operation not found');
    }

    return this.jsonResponse(200, sync);
  }

  /**
   * POST /admin/retry/{syncId} - Retry a failed sync
   */
  async retrySyncOperation(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const syncId = event.pathParameters?.syncId;
    if (!syncId) {
      return this.errorResponse(400, 'Missing syncId parameter');
    }

    const sync = this.syncTracker.getSync(syncId);
    if (!sync) {
      return this.errorResponse(404, 'Sync operation not found');
    }

    if (sync.status !== 'failed') {
      return this.errorResponse(409, 'Sync operation is not in failed state');
    }

    // TODO: Trigger actual retry
    return this.jsonResponse(202, {
      syncId: `retry-${Date.now()}`,
      status: 'accepted',
      message: 'Retry initiated',
    });
  }

  /**
   * GET /admin/health - Get system health
   */
  async getHealth(): Promise<APIGatewayProxyResult> {
    const consecutiveFailures = this.syncTracker.getConsecutiveFailures();
    const recentSyncs = this.syncTracker.getRecentSyncs(1);
    const lastSync = recentSyncs[0];

    const status = consecutiveFailures >= 3 ? 'degraded' : 'healthy';

    return this.jsonResponse(200, {
      status,
      components: {
        s3: { status: 'healthy' }, // Would check actual S3 connectivity
        cloudfront: { status: 'healthy' },
        sns: { status: 'healthy' },
      },
      lastSyncAt: lastSync?.startedAt ?? null,
      consecutiveFailures,
    });
  }

  private jsonResponse(statusCode: number, body: object): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
  }

  private errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
    return this.jsonResponse(statusCode, { error: message });
  }
}
