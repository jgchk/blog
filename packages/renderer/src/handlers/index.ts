import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { GitHubWebhookHandler } from './webhook.js';

// Initialize handlers
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? '';
const webhookHandler = new GitHubWebhookHandler(webhookSecret);

/**
 * Lambda entry point for GitHub webhook
 */
export async function handleWebhook(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  return webhookHandler.handle(event, context);
}

// Export for testing
export { GitHubWebhookHandler } from './webhook.js';
