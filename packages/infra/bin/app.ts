#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlogStack } from '../lib/blog-stack.js';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const githubWebhookSecret = app.node.tryGetContext('githubWebhookSecret') || process.env.GITHUB_WEBHOOK_SECRET || '';

if (!githubWebhookSecret) {
  console.warn('Warning: GITHUB_WEBHOOK_SECRET not set. Webhook validation will fail.');
}

new BlogStack(app, `BlogStack-${environment}`, {
  environment,
  githubWebhookSecret,
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
