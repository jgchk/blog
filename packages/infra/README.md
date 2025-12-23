# Blog Infrastructure (AWS CDK)

AWS CDK infrastructure for the markdown blog.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 20.x
- pnpm

## Stack Components

- **S3 Bucket**: Stores rendered HTML content
- **CloudFront Distribution**: CDN for serving static content
- **Lambda Functions**:
  - Render function: Processes GitHub webhooks and renders markdown
  - Admin function: Provides status, health, and retry endpoints
- **API Gateway**: REST API for webhook and admin endpoints
- **SNS Topic**: Failure alerts

## Deployment

```bash
# Install dependencies
pnpm install

# Synthesize CloudFormation template
pnpm run cdk synth

# Deploy to AWS
pnpm run cdk deploy --context environment=dev --context githubWebhookSecret=YOUR_SECRET

# Deploy with alert email
pnpm run cdk deploy \
  --context environment=prod \
  --context githubWebhookSecret=YOUR_SECRET \
  --context alertEmail=alerts@example.com
```

## GitHub Webhook Configuration

After deployment, configure the GitHub webhook:

1. **Get Webhook URL**: After CDK deployment, note the `WebhookUrl` output:
   ```
   Outputs:
   BlogStack.WebhookUrl = https://xxx.execute-api.region.amazonaws.com/v1/webhook/github
   ```

2. **Configure GitHub Repository**:
   - Go to your repository → Settings → Webhooks → Add webhook
   - **Payload URL**: Use the `WebhookUrl` from CDK output
   - **Content type**: `application/json`
   - **Secret**: Use the same secret as `githubWebhookSecret` context variable
   - **Events**: Select "Just the push event"
   - **Active**: Check this box

3. **Verify Configuration**:
   - Push a commit to your repository
   - Check the webhook delivery in GitHub (Settings → Webhooks → Recent Deliveries)
   - Successful deliveries should show 200 status code

## Security

- Webhook endpoint validates `X-Hub-Signature-256` header using HMAC-SHA256
- Admin endpoints require IAM authentication
- S3 bucket blocks all public access; CloudFront uses OAI

## CDK Outputs

| Output | Description |
|--------|-------------|
| `BucketName` | S3 bucket for rendered content |
| `DistributionDomain` | CloudFront domain name |
| `WebhookUrl` | GitHub webhook endpoint |
| `ApiEndpoint` | API Gateway base URL |

## Admin API Endpoints

All admin endpoints require IAM authentication:

- `GET /admin/status` - List recent sync operations
- `GET /admin/status/{syncId}` - Get specific sync details
- `POST /admin/retry/{syncId}` - Retry a failed sync
- `GET /admin/health` - System health check
