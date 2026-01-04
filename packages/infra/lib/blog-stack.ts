import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import type { Construct } from 'constructs';

export interface BlogStackProps extends cdk.StackProps {
  /** Environment name (dev, staging, prod) */
  environment: string;
  /** Domain configuration (optional, typically only for prod) */
  domainConfig?: {
    /** Root domain name, e.g., 'jake.cafe' */
    domainName: string;
    /** Subdomain for the blog, e.g., 'blog' */
    subdomain: string;
  };
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

    // Custom domain configuration (only when domainConfig is provided)
    let hostedZone: route53.HostedZone | undefined;
    let certificate: acm.Certificate | undefined;
    const blogDomain = props.domainConfig
      ? `${props.domainConfig.subdomain}.${props.domainConfig.domainName}`
      : undefined;

    if (props.domainConfig) {
      // Route 53 Hosted Zone for the root domain
      hostedZone = new route53.HostedZone(this, 'HostedZone', {
        zoneName: props.domainConfig.domainName,
        comment: `Hosted zone for ${props.domainConfig.domainName}`,
      });

      // ACM Certificate with DNS validation
      certificate = new acm.Certificate(this, 'Certificate', {
        domainName: blogDomain!,
        certificateName: `blog-certificate-${props.environment}`,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

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
      // Custom domain configuration
      ...(blogDomain && certificate
        ? {
            domainNames: [blogDomain],
            certificate: certificate,
          }
        : {}),
      // TODO: Add custom 404 page when template is created
      // errorResponses: [
      //   {
      //     httpStatus: 404,
      //     responseHttpStatus: 404,
      //     responsePagePath: '/404.html',
      //   },
      // ],
    });

    // Route 53 A Record alias to CloudFront (only when domainConfig is provided)
    if (props.domainConfig && hostedZone) {
      new route53.ARecord(this, 'BlogAliasRecord', {
        zone: hostedZone,
        recordName: props.domainConfig.subdomain,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.distribution),
        ),
        comment: `Alias record for ${blogDomain} pointing to CloudFront`,
      });
    }

    // Grant GitHub Actions role permissions to sync content and invalidate cache
    const githubActionsRole = iam.Role.fromRoleName(
      this,
      'GitHubActionsRole',
      'GitHubActions-CDK-Deploy',
    );
    this.contentBucket.grantReadWrite(githubActionsRole);
    this.distribution.grant(githubActionsRole, 'cloudfront:CreateInvalidation');

    // Grant Route 53 Domains permissions for nameserver updates (only for prod with custom domain)
    if (props.domainConfig) {
      new iam.Policy(this, 'Route53DomainsPolicy', {
        policyName: `blog-route53-domains-${props.environment}`,
        roles: [githubActionsRole],
        statements: [
          new iam.PolicyStatement({
            actions: [
              'route53domains:GetDomainDetail',
              'route53domains:UpdateDomainNameservers',
            ],
            resources: ['*'], // Route 53 Domains doesn't support resource-level permissions
          }),
        ],
      });
    }

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

    // Custom domain outputs (only when domainConfig is provided)
    if (props.domainConfig && hostedZone && blogDomain) {
      new cdk.CfnOutput(this, 'NameServers', {
        value: cdk.Fn.join(', ', hostedZone.hostedZoneNameServers || []),
        description: 'Update Route 53 Registered Domains with these nameservers',
      });

      new cdk.CfnOutput(this, 'BlogUrl', {
        value: `https://${blogDomain}`,
        description: 'Blog URL with custom domain',
      });
    }
  }
}
