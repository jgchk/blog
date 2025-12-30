#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack.js';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';

new BlogStack(app, `BlogStack-${environment}`, {
  environment,
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
