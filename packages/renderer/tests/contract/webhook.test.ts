import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubWebhookHandler } from '../../src/handlers/webhook.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import crypto from 'crypto';

describe('GitHubWebhookHandler Contract', () => {
  let handler: GitHubWebhookHandler;
  const webhookSecret = 'test-secret';

  beforeEach(() => {
    handler = new GitHubWebhookHandler(webhookSecret);
  });

  const createEvent = (body: object, signature?: string): APIGatewayProxyEvent => {
    const bodyString = JSON.stringify(body);
    const sig = signature ?? createSignature(bodyString, webhookSecret);

    return {
      body: bodyString,
      headers: {
        'X-Hub-Signature-256': sig,
        'X-GitHub-Event': 'push',
        'Content-Type': 'application/json',
      },
      httpMethod: 'POST',
      path: '/webhook/github',
      isBase64Encoded: false,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: '',
      multiValueHeaders: {},
    };
  };

  const createSignature = (payload: string, secret: string): string => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  };

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  describe('signature validation', () => {
    it('should reject requests with missing signature', async () => {
      const event = createEvent({ ref: 'refs/heads/main' }, '');
      event.headers['X-Hub-Signature-256'] = '';

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toHaveProperty('error');
    });

    it('should reject requests with invalid signature', async () => {
      const event = createEvent({ ref: 'refs/heads/main' });
      event.headers['X-Hub-Signature-256'] = 'sha256=invalid';

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toHaveProperty('error');
    });

    it('should accept requests with valid signature', async () => {
      const event = createEvent({
        ref: 'refs/heads/main',
        commits: [],
        repository: { full_name: 'user/repo' },
      });

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('push event handling', () => {
    it('should return 200 for valid push event', async () => {
      const event = createEvent({
        ref: 'refs/heads/main',
        commits: [
          {
            id: 'abc123',
            added: ['posts/new-article/index.md'],
            modified: [],
            removed: [],
          },
        ],
        repository: { full_name: 'user/repo', clone_url: 'https://github.com/user/repo.git' },
      });

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('syncId');
      expect(body).toHaveProperty('status', 'accepted');
    });

    it('should ignore non-main branch pushes', async () => {
      const event = createEvent({
        ref: 'refs/heads/feature-branch',
        commits: [],
        repository: { full_name: 'user/repo' },
      });

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('status', 'ignored');
    });

    it('should return affected files in response', async () => {
      const event = createEvent({
        ref: 'refs/heads/main',
        commits: [
          {
            id: 'abc123',
            added: ['posts/article-1/index.md'],
            modified: ['posts/article-2/index.md'],
            removed: ['posts/article-3/index.md'],
          },
        ],
        repository: { full_name: 'user/repo' },
      });

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('syncId');
    });
  });

  describe('error handling', () => {
    it('should return 400 for missing body', async () => {
      const event = createEvent({});
      event.body = null;

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const event = createEvent({});
      event.body = 'not valid json';

      const result = await handler.handle(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });
});
