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

  describe('No Custom Domain (dev/staging)', () => {
    it('does not create Route 53 hosted zone', () => {
      const hostedZones = template.findResources('AWS::Route53::HostedZone');
      expect(Object.keys(hostedZones)).toHaveLength(0);
    });

    it('does not create ACM certificate', () => {
      const certificates = template.findResources(
        'AWS::CertificateManager::Certificate',
      );
      expect(Object.keys(certificates)).toHaveLength(0);
    });

    it('CloudFront has no custom domain aliases', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.not(
          Match.objectLike({
            Aliases: Match.anyValue(),
          }),
        ),
      });
    });

    it('does not create Route 53 A record', () => {
      const records = template.findResources('AWS::Route53::RecordSet');
      expect(Object.keys(records)).toHaveLength(0);
    });

    it('does not export NameServers output', () => {
      const outputs = template.findOutputs('NameServers');
      expect(Object.keys(outputs)).toHaveLength(0);
    });

    it('does not export BlogUrl output', () => {
      const outputs = template.findOutputs('BlogUrl');
      expect(Object.keys(outputs)).toHaveLength(0);
    });
  });
});

describe('BlogStack with Custom Domain (Production)', () => {
  const prodApp = new cdk.App();
  const prodStack = new BlogStack(prodApp, 'ProdTestStack', {
    environment: 'prod',
    domainConfig: {
      domainName: 'jake.cafe',
      subdomain: 'blog',
    },
    env: {
      account: '123456789012',
      region: 'us-east-1',
    },
  });
  const prodTemplate = Template.fromStack(prodStack);

  describe('Route 53', () => {
    it('creates hosted zone for root domain', () => {
      prodTemplate.hasResourceProperties('AWS::Route53::HostedZone', {
        Name: 'jake.cafe.',
      });
    });

    it('creates A record alias for blog subdomain', () => {
      prodTemplate.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'blog.jake.cafe.',
        Type: 'A',
      });
    });
  });

  describe('ACM Certificate', () => {
    it('creates certificate for blog subdomain', () => {
      prodTemplate.hasResourceProperties(
        'AWS::CertificateManager::Certificate',
        {
          DomainName: 'blog.jake.cafe',
          ValidationMethod: 'DNS',
        },
      );
    });
  });

  describe('CloudFront with Custom Domain', () => {
    it('configures custom domain alias', () => {
      prodTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: ['blog.jake.cafe'],
        },
      });
    });

    it('associates ACM certificate', () => {
      prodTemplate.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          ViewerCertificate: {
            AcmCertificateArn: Match.anyValue(),
            SslSupportMethod: 'sni-only',
          },
        },
      });
    });
  });

  describe('Stack Outputs', () => {
    it('exports NameServers for DNS migration', () => {
      const outputs = prodTemplate.findOutputs('NameServers');
      expect(Object.keys(outputs)).toHaveLength(1);
    });

    it('exports BlogUrl with custom domain', () => {
      const outputs = prodTemplate.findOutputs('BlogUrl');
      expect(Object.keys(outputs)).toHaveLength(1);
    });
  });

  describe('IAM Permissions', () => {
    it('creates Route 53 Domains policy for nameserver updates', () => {
      prodTemplate.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'route53domains:GetDomainDetail',
                'route53domains:UpdateDomainNameservers',
              ],
            }),
          ]),
        },
      });
    });
  });
});
