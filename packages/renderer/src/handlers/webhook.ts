import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import crypto from 'crypto';
import type { SyncOrchestrator, SyncRequest } from '../services/sync-orchestrator.js';
import { parseRepository } from '../utils/github.js';

/**
 * GitHub push event payload (simplified)
 */
interface GitHubPushEvent {
  ref: string;
  commits: Array<{
    id: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  repository: {
    full_name: string;
    clone_url?: string;
  };
}

/**
 * Webhook response
 */
interface WebhookResponse {
  syncId?: string;
  status: 'accepted' | 'ignored';
  message?: string;
}

/**
 * Handles GitHub webhook events for the blog.
 * Per contracts/api.yaml specification.
 */
export class GitHubWebhookHandler {
  private webhookSecret: string;
  private mainBranch: string;
  private orchestrator?: SyncOrchestrator;

  constructor(
    webhookSecret: string,
    mainBranch: string = 'main',
    orchestrator?: SyncOrchestrator
  ) {
    this.webhookSecret = webhookSecret;
    this.mainBranch = mainBranch;
    this.orchestrator = orchestrator;
  }

  /**
   * Handle incoming webhook request
   */
  async handle(
    event: APIGatewayProxyEvent,
    _context: Context
  ): Promise<APIGatewayProxyResult> {
    // Validate request body exists
    if (!event.body) {
      return this.errorResponse(400, 'Missing request body');
    }

    // Parse payload first to validate JSON
    let payload: GitHubPushEvent;
    try {
      payload = JSON.parse(event.body) as GitHubPushEvent;
    } catch {
      return this.errorResponse(400, 'Invalid JSON payload');
    }

    // Validate signature
    const signature = event.headers['X-Hub-Signature-256'] || event.headers['x-hub-signature-256'];
    if (!signature || !this.verifySignature(event.body, signature)) {
      return this.errorResponse(401, 'Invalid webhook signature');
    }

    // Validate it's a push event
    const githubEvent = event.headers['X-GitHub-Event'] || event.headers['x-github-event'];
    if (githubEvent !== 'push') {
      return this.jsonResponse(200, {
        status: 'ignored',
        message: `Event type '${githubEvent}' is not handled`,
      });
    }

    // Check if it's the main branch
    if (!this.isMainBranch(payload.ref)) {
      return this.jsonResponse(200, {
        status: 'ignored',
        message: `Branch '${payload.ref}' is not the main branch`,
      });
    }

    // Extract affected files
    const affectedFiles = this.extractAffectedFiles(payload);

    // Check if there are any post changes
    const totalChanges =
      affectedFiles.added.length + affectedFiles.modified.length + affectedFiles.removed.length;

    if (totalChanges === 0) {
      return this.jsonResponse(200, {
        status: 'ignored',
        message: 'No post changes detected',
      } as WebhookResponse);
    }

    // If orchestrator is configured, trigger sync
    if (this.orchestrator) {
      const commitHash = payload.commits[0]?.id ?? 'unknown';

      const request: SyncRequest = {
        type: 'incremental',
        repository: parseRepository(payload.repository, this.mainBranch),
        changes: affectedFiles,
        commitHash,
      };

      try {
        const result = await this.orchestrator.sync(request);

        return this.jsonResponse(200, {
          syncId: result.syncId,
          status: 'accepted',
          message: `Processed ${result.articlesRendered.length} articles`,
        } as WebhookResponse);
      } catch (error) {
        console.error('Sync failed:', error);
        // Still return 200 to acknowledge webhook receipt
        return this.jsonResponse(200, {
          status: 'accepted',
          message: `Sync initiated but encountered errors`,
        } as WebhookResponse);
      }
    }

    // Fallback: generate sync ID and acknowledge without orchestrator
    const syncId = this.generateSyncId();

    return this.jsonResponse(200, {
      syncId,
      status: 'accepted',
      message: `Processing ${affectedFiles.added.length + affectedFiles.modified.length} files`,
    } as WebhookResponse);
  }

  /**
   * Verify GitHub webhook signature using timing-safe comparison.
   * Per GITHUB_WEBHOOK_SECRET environment variable.
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex')}`;

    // Use length-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if ref is the main branch
   */
  private isMainBranch(ref: string): boolean {
    return ref === `refs/heads/${this.mainBranch}`;
  }

  /**
   * Extract affected files from push event
   */
  private extractAffectedFiles(payload: GitHubPushEvent): {
    added: string[];
    modified: string[];
    removed: string[];
  } {
    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    for (const commit of payload.commits) {
      added.push(...commit.added.filter((f) => f.startsWith('posts/')));
      modified.push(...commit.modified.filter((f) => f.startsWith('posts/')));
      removed.push(...commit.removed.filter((f) => f.startsWith('posts/')));
    }

    return { added, modified, removed };
  }

  /**
   * Generate a unique sync ID
   */
  private generateSyncId(): string {
    return `sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create JSON response
   */
  private jsonResponse(statusCode: number, body: object): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
  }

  /**
   * Create error response
   */
  private errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
    return this.jsonResponse(statusCode, { error: message });
  }
}
