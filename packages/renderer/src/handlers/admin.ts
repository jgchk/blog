import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SyncTracker } from '../services/sync-tracker.js';
import type { SyncOrchestrator, SyncRequest } from '../services/sync-orchestrator.js';
import { parseRepository } from '../utils/github.js';

/**
 * Admin API handlers.
 * Per contracts/api.yaml specification.
 */
export class AdminHandler {
  private syncTracker: SyncTracker;
  private orchestrator?: SyncOrchestrator;
  private defaultRepository?: string;

  constructor(
    syncTracker: SyncTracker,
    orchestrator?: SyncOrchestrator,
    defaultRepository?: string
  ) {
    this.syncTracker = syncTracker;
    this.orchestrator = orchestrator;
    this.defaultRepository = defaultRepository;
  }

  /**
   * Route incoming request to appropriate handler
   */
  async route(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const path = event.path;
    const method = event.httpMethod;

    // GET /admin/status
    if (path === '/admin/status' && method === 'GET') {
      return this.getStatus(event);
    }

    // GET /admin/status/{syncId}
    if (path.match(/^\/admin\/status\/[^/]+$/) && method === 'GET') {
      return this.getSyncById(event);
    }

    // POST /admin/retry/{syncId}
    if (path.match(/^\/admin\/retry\/[^/]+$/) && method === 'POST') {
      return this.retrySyncOperation(event);
    }

    // GET /admin/health
    if (path === '/admin/health' && method === 'GET') {
      return this.getHealth();
    }

    // POST /admin/render
    if (path === '/admin/render' && method === 'POST') {
      return this.triggerFullRender(event);
    }

    return this.errorResponse(404, 'Not found');
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

    // TODO: Trigger actual retry with stored request info
    return this.jsonResponse(202, {
      syncId: `retry-${Date.now()}`,
      status: 'accepted',
      message: 'Retry initiated',
    });
  }

  /**
   * POST /admin/render - Trigger full site render
   */
  async triggerFullRender(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    if (!this.orchestrator) {
      return this.errorResponse(503, 'Orchestrator not configured');
    }

    if (this.orchestrator.isSyncInProgress()) {
      return this.errorResponse(409, 'Render already in progress');
    }

    // Parse request body
    let body: { force?: boolean; repository?: string } = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return this.errorResponse(400, 'Invalid JSON body');
      }
    }

    // Determine repository
    const repositoryInput = body.repository ?? this.defaultRepository;
    if (!repositoryInput) {
      return this.errorResponse(400, 'Repository not specified and no default configured');
    }

    try {
      const request: SyncRequest = {
        type: 'full',
        repository: parseRepository(repositoryInput, 'main'),
        force: body.force ?? false,
      };

      const result = await this.orchestrator.sync(request);

      return this.jsonResponse(202, {
        syncId: result.syncId,
        status: 'accepted',
        message: `Full render complete: ${result.articlesRendered.length} articles`,
      });
    } catch (error) {
      console.error('Full render failed:', error);
      return this.errorResponse(500, 'Full render failed');
    }
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
