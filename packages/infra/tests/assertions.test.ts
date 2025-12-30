import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BlogStack } from '../lib/blog-stack.js';

/**
 * CDK Assertion tests.
 * Per 007-pipeline-rendering: Simplified infrastructure (S3 + CloudFront only).
 * Webhook Lambda, API Gateway, and SNS have been removed.
 */
describe('BlogStack Assertion Tests', () => {
  const app = new cdk.App();
  const stack = new BlogStack(app, 'TestStack', {
    environment: 'test',
    env: {
      account: '123456789012',
      region: 'us-east-1',
    },
  });

  const template = Template.fromStack(stack);

  describe('S3 Bucket Security', () => {
    it('blocks all public access', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('enables versioning for rollback capability', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('uses S3-managed encryption', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
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
  });

  describe('CloudFront', () => {
    it('redirects HTTP to HTTPS', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultCacheBehavior: {
            ViewerProtocolPolicy: 'redirect-to-https',
          },
        },
      });
    });

    // TODO: Re-enable when 404 template is created
    it.skip('has 404 error response configured', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({
              ErrorCode: 404,
              ResponseCode: 404,
              ResponsePagePath: '/404.html',
            }),
          ]),
        },
      });
    });

    it('uses caching optimized policy', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultCacheBehavior: {
            CachePolicyId: Match.anyValue(),
          },
        },
      });
    });

    it('has S3 origin configured', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Origins: Match.arrayWith([
            Match.objectLike({
              S3OriginConfig: Match.anyValue(),
            }),
          ]),
        },
      });
    });

    it('has URL rewrite function for clean URLs', () => {
      // Verify CloudFront Function exists
      template.hasResourceProperties('AWS::CloudFront::Function', {
        Name: 'blog-url-rewrite-test',
        FunctionConfig: {
          Runtime: 'cloudfront-js-1.0',
        },
      });

      // Verify function is associated with distribution
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          DefaultCacheBehavior: {
            FunctionAssociations: Match.arrayWith([
              Match.objectLike({
                EventType: 'viewer-request',
              }),
            ]),
          },
        },
      });
    });
  });

  describe('Stack Outputs', () => {
    it('exports bucket name', () => {
      const outputs = template.findOutputs('BucketName');
      expect(Object.keys(outputs)).toHaveLength(1);
    });

    it('exports CloudFront domain', () => {
      const outputs = template.findOutputs('DistributionDomain');
      expect(Object.keys(outputs)).toHaveLength(1);
    });

    it('exports CloudFront distribution ID', () => {
      const outputs = template.findOutputs('DistributionId');
      expect(Object.keys(outputs)).toHaveLength(1);
    });
  });

  describe('Simplified Infrastructure (007-pipeline-rendering)', () => {
    it('does not create Lambda functions', () => {
      const lambdaFunctions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(lambdaFunctions)).toHaveLength(0);
    });

    it('does not create API Gateway', () => {
      const apiGateways = template.findResources('AWS::ApiGateway::RestApi');
      expect(Object.keys(apiGateways)).toHaveLength(0);
    });

    it('does not create SNS topic', () => {
      const snsTopics = template.findResources('AWS::SNS::Topic');
      expect(Object.keys(snsTopics)).toHaveLength(0);
    });
  });
});
