import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BlogStack } from '../lib/blog-stack.js';

/**
 * CDK Snapshot tests.
 * Per T079: Verify infrastructure template matches expected structure.
 */
describe('BlogStack Snapshot Tests', () => {
  const app = new cdk.App();
  const stack = new BlogStack(app, 'TestStack', {
    environment: 'test',
    githubWebhookSecret: 'test-secret-123',
    env: {
      account: '123456789012',
      region: 'us-east-1',
    },
  });

  const template = Template.fromStack(stack);

  it('creates the expected S3 bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  it('creates the expected Lambda functions', () => {
    // Render function
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'blog-render-test',
      Runtime: 'nodejs20.x',
      Timeout: 30,
      MemorySize: 256,
    });

    // Admin function
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'blog-admin-test',
      Runtime: 'nodejs20.x',
      Timeout: 10,
      MemorySize: 128,
    });
  });

  it('creates CloudFront distribution', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'pages/index.html',
      },
    });
  });

  it('creates SNS topic for alerts', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'blog-alerts-test',
      DisplayName: 'Blog Sync Alerts',
    });
  });

  it('creates API Gateway with webhook and admin resources', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'blog-api-test',
    });

    // Verify methods exist (POST webhook + 4 admin endpoints + OPTIONS for CORS)
    // The exact count may vary based on CORS configuration
    const methods = template.findResources('AWS::ApiGateway::Method');
    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(5);
  });

  it('has expected number of resources', () => {
    // Count key resources to detect unintended changes
    template.resourceCountIs('AWS::S3::Bucket', 1);
    // Lambda functions: render + admin + potentially log retention custom resource
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdaFunctions).length).toBeGreaterThanOrEqual(2);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  it('matches overall template structure', () => {
    // Verify key outputs exist
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContain('BucketName');
    expect(Object.keys(outputs)).toContain('DistributionDomain');
    expect(Object.keys(outputs)).toContain('WebhookUrl');
    expect(Object.keys(outputs)).toContain('ApiEndpoint');
  });
});
