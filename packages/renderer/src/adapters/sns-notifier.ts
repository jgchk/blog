import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { NotificationAdapter, NotificationMessage } from '@blog/core';

/**
 * SNS implementation of NotificationAdapter.
 * Per research.md specification for alerting.
 */
export class SNSNotificationAdapter implements NotificationAdapter {
  private client: SNSClient;
  private topicArn: string;

  constructor(topicArn: string, region?: string) {
    this.client = new SNSClient({ region: region ?? process.env.AWS_REGION });
    this.topicArn = topicArn;
  }

  async send(message: NotificationMessage): Promise<void> {
    const severityEmoji = {
      info: 'INFO',
      warning: 'WARN',
      error: 'ERROR',
      critical: 'CRITICAL',
    };

    const command = new PublishCommand({
      TopicArn: this.topicArn,
      Subject: `[${severityEmoji[message.severity]}] ${message.subject}`,
      Message: this.formatMessage(message),
      MessageAttributes: {
        severity: {
          DataType: 'String',
          StringValue: message.severity,
        },
      },
    });

    await this.client.send(command);
  }

  private formatMessage(message: NotificationMessage): string {
    let text = message.body;

    if (message.metadata && Object.keys(message.metadata).length > 0) {
      text += '\n\nMetadata:\n';
      for (const [key, value] of Object.entries(message.metadata)) {
        text += `- ${key}: ${value}\n`;
      }
    }

    return text;
  }
}
