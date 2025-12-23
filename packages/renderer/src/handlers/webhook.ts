import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import crypto from 'crypto';

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

  constructor(webhookSecret: string, mainBranch: string = 'main') {
    this.webhookSecret = webhookSecret;
    this.mainBranch = mainBranch;
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

    // Generate sync ID
    const syncId = this.generateSyncId();

    // TODO: Trigger async rendering process
    // For now, just acknowledge the webhook

    return this.jsonResponse(200, {
      syncId,
      status: 'accepted',
      message: `Processing ${affectedFiles.added.length + affectedFiles.modified.length} files`,
    } as WebhookResponse);
  }

  /**
   * Verify GitHub webhook signature
   */
  private verifySignature(payload: string, signature: string): boolean {
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
