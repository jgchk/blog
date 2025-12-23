import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export interface BlogStackProps extends cdk.StackProps {
  /** Environment name (dev, staging, prod) */
  environment: string;
  /** GitHub webhook secret for signature validation */
  githubWebhookSecret: string;
  /** Email address for alert notifications */
  alertEmail?: string;
}

export class BlogStack extends cdk.Stack {
  public readonly contentBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly alertTopic: sns.Topic;
  public readonly api: apigateway.RestApi;

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

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'pages/index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/pages/404.html',
        },
      ],
    });

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `blog-alerts-${props.environment}`,
      displayName: 'Blog Sync Alerts',
    });

    // Render Lambda function
    const renderFunction = new lambda.Function(this, 'RenderFunction', {
      functionName: `blog-render-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handleWebhook',
      code: lambda.Code.fromAsset('../renderer/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        S3_BUCKET: this.contentBucket.bucketName,
        CLOUDFRONT_DISTRIBUTION_ID: this.distribution.distributionId,
        GITHUB_WEBHOOK_SECRET: props.githubWebhookSecret,
        SNS_TOPIC_ARN: this.alertTopic.topicArn,
        NODE_ENV: props.environment,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant permissions
    this.contentBucket.grantReadWrite(renderFunction);
    this.alertTopic.grantPublish(renderFunction);

    // CloudFront invalidation permission
    renderFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
        ],
      })
    );

    // Admin Lambda function
    const adminFunction = new lambda.Function(this, 'AdminFunction', {
      functionName: `blog-admin-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handleAdmin',
      code: lambda.Code.fromAsset('../renderer/dist'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        S3_BUCKET: this.contentBucket.bucketName,
        NODE_ENV: props.environment,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    this.contentBucket.grantRead(adminFunction);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `blog-api-${props.environment}`,
      description: 'Blog webhook and admin API',
      deployOptions: {
        stageName: 'v1',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
      },
    });

    // Webhook endpoint (public, uses signature validation)
    const webhookResource = this.api.root.addResource('webhook');
    const githubResource = webhookResource.addResource('github');
    githubResource.addMethod('POST', new apigateway.LambdaIntegration(renderFunction));

    // Admin endpoints (IAM auth)
    const adminResource = this.api.root.addResource('admin');
    const adminIntegration = new apigateway.LambdaIntegration(adminFunction);

    // /admin/status
    const statusResource = adminResource.addResource('status');
    statusResource.addMethod('GET', adminIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    // /admin/status/{syncId}
    const syncIdResource = statusResource.addResource('{syncId}');
    syncIdResource.addMethod('GET', adminIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    // /admin/retry/{syncId}
    const retryResource = adminResource.addResource('retry');
    const retryIdResource = retryResource.addResource('{syncId}');
    retryIdResource.addMethod('POST', adminIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    // /admin/health
    const healthResource = adminResource.addResource('health');
    healthResource.addMethod('GET', adminIntegration, {
      authorizationType: apigateway.AuthorizationType.IAM,
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.contentBucket.bucketName,
      description: 'S3 bucket for rendered content',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });

    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${this.api.url}webhook/github`,
      description: 'GitHub webhook URL',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint',
    });
  }
}
