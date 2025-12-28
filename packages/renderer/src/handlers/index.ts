import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { GitHubWebhookHandler } from './webhook.js';
import { AdminHandler } from './admin.js';
import { S3StorageAdapter } from '../adapters/s3-storage.js';
import { SNSNotificationAdapter } from '../adapters/sns-notifier.js';
import { GitHubContentFetcher } from '../adapters/github-content.js';
import { RenderService } from '../services/render-service.js';
import { SyncTracker } from '../services/sync-tracker.js';
import { SyncOrchestrator, type CloudFrontInvalidator } from '../services/sync-orchestrator.js';

// Environment variables
const S3_BUCKET = process.env.S3_BUCKET ?? '';
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID ?? '';
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? '';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN ?? '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

// Initialize shared dependencies
const storage = new S3StorageAdapter(S3_BUCKET);
const notifier = new SNSNotificationAdapter(SNS_TOPIC_ARN);
const syncTracker = new SyncTracker();
const contentFetcher = new GitHubContentFetcher();
const renderService = new RenderService(storage);

// CloudFront client wrapper
const cloudFrontClient = new CloudFrontClient({});
const cloudFront: CloudFrontInvalidator = {
  async createInvalidation(params) {
    await cloudFrontClient.send(
      new CreateInvalidationCommand({
        DistributionId: params.DistributionId,
        InvalidationBatch: params.InvalidationBatch,
      })
    );
  },
};

// Initialize orchestrator (only if all required env vars are present)
let orchestrator: SyncOrchestrator | undefined;
if (S3_BUCKET && CLOUDFRONT_DISTRIBUTION_ID && SNS_TOPIC_ARN) {
  orchestrator = new SyncOrchestrator({
    contentFetcher,
    storage,
    notifier,
    renderService,
    syncTracker,
    distributionId: CLOUDFRONT_DISTRIBUTION_ID,
    cloudFront,
  });
}

// Initialize handlers
const webhookHandler = new GitHubWebhookHandler(GITHUB_WEBHOOK_SECRET, 'main', orchestrator);
const adminHandler = new AdminHandler(syncTracker, orchestrator, GITHUB_REPOSITORY);

/**
 * Lambda entry point for GitHub webhook
 */
export async function handleWebhook(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  return webhookHandler.handle(event, context);
}

/**
 * Lambda entry point for admin API
 */
export async function handleAdmin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return adminHandler.route(event);
}

// Export for testing
export { GitHubWebhookHandler } from './webhook.js';
export { AdminHandler } from './admin.js';
