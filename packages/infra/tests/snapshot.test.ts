import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BlogStack } from '../lib/blog-stack.js';

/**
 * CDK Snapshot tests.
 * Per 007-pipeline-rendering: Simplified infrastructure (S3 + CloudFront only).
 * Webhook Lambda, API Gateway, and SNS have been removed.
 */
describe('BlogStack Snapshot Tests', () => {
  const app = new cdk.App();
  const stack = new BlogStack(app, 'TestStack', {
    environment: 'test',
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

  it('creates CloudFront distribution', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'pages/index.html',
      },
    });
  });

  it('has expected number of resources (simplified stack)', () => {
    // Count key resources to detect unintended changes
    // After 007-pipeline-rendering, stack contains only S3 + CloudFront
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);

    // These should NOT exist (removed in 007-pipeline-rendering)
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdaFunctions)).toHaveLength(0);

    const snsTopics = template.findResources('AWS::SNS::Topic');
    expect(Object.keys(snsTopics)).toHaveLength(0);

    const apiGateways = template.findResources('AWS::ApiGateway::RestApi');
    expect(Object.keys(apiGateways)).toHaveLength(0);
  });

  it('matches overall template structure', () => {
    // Verify key outputs exist
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContain('BucketName');
    expect(Object.keys(outputs)).toContain('DistributionDomain');
    expect(Object.keys(outputs)).toContain('DistributionId');

    // These outputs should NOT exist (removed in 007-pipeline-rendering)
    expect(Object.keys(outputs)).not.toContain('WebhookUrl');
    expect(Object.keys(outputs)).not.toContain('ApiEndpoint');
  });
});
