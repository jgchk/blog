import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface BlogStackProps extends cdk.StackProps {
  /** Environment name (dev, staging, prod) */
  environment: string;
}

export class BlogStack extends cdk.Stack {
  public readonly contentBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: BlogStackProps) {
    super(scope, id, props);

    // S3 Bucket for rendered content
    this.contentBucket = new s3.Bucket(this, 'ContentBucket', {
      bucketName: `blog-content-${props.environment}-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // CloudFront Function to handle clean URLs (append index.html to directory paths)
    const urlRewriteFunction = new cloudfront.Function(this, 'UrlRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If URI ends with '/', append index.html
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  }
  // If URI doesn't have a file extension, append /index.html
  else if (!uri.includes('.')) {
    request.uri = uri + '/index.html';
  }

  return request;
}
      `),
      functionName: `blog-url-rewrite-${props.environment}`,
      comment: 'Rewrites clean URLs to index.html for static site hosting',
    });

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: urlRewriteFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: 'index.html',
      // TODO: Add custom 404 page when template is created
      // errorResponses: [
      //   {
      //     httpStatus: 404,
      //     responseHttpStatus: 404,
      //     responsePagePath: '/404.html',
      //   },
      // ],
    });

    // Grant GitHub Actions role permissions to sync content and invalidate cache
    const githubActionsRole = iam.Role.fromRoleName(
      this,
      'GitHubActionsRole',
      'GitHubActions-CDK-Deploy',
    );
    this.contentBucket.grantReadWrite(githubActionsRole);
    this.distribution.grant(githubActionsRole, 'cloudfront:CreateInvalidation');

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.contentBucket.bucketName,
      description: 'S3 bucket for rendered content',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    });
  }
}
