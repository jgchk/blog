#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack.js';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';

// Domain configuration only for production
const domainConfig =
  environment === 'prod'
    ? {
        domainName: 'jake.cafe',
        subdomain: 'blog',
      }
    : undefined;

new BlogStack(app, `BlogStack-${environment}`, {
  environment,
  domainConfig,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'blog',
    Environment: environment,
  },
});

app.synth();
