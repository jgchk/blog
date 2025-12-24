import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { SNSNotificationAdapter } from '../../../src/adapters/sns-notifier.js';
import type { NotificationMessage } from '@blog/core';

const snsMock = mockClient(SNSClient);

describe('SNSNotificationAdapter', () => {
  const topicArn = 'arn:aws:sns:us-east-1:123456789012:blog-alerts';
  let adapter: SNSNotificationAdapter;

  beforeEach(() => {
    snsMock.reset();
    adapter = new SNSNotificationAdapter(topicArn, 'us-east-1');
  });

  describe('send', () => {
    it('sends notification with correct topic ARN', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Test Alert',
        body: 'Test body',
        severity: 'info',
      };

      await adapter.send(message);

      const calls = snsMock.calls();
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        TopicArn: topicArn,
      });
    });

    it('formats subject with INFO severity prefix', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Information',
        body: 'Body',
        severity: 'info',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Subject).toBe('[INFO] Information');
    });

    it('formats subject with WARN severity prefix', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Warning',
        body: 'Body',
        severity: 'warning',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Subject).toBe('[WARN] Warning');
    });

    it('formats subject with ERROR severity prefix', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Error Alert',
        body: 'Body',
        severity: 'error',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Subject).toBe('[ERROR] Error Alert');
    });

    it('formats subject with CRITICAL severity prefix', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Critical Alert',
        body: 'Body',
        severity: 'critical',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Subject).toBe('[CRITICAL] Critical Alert');
    });

    it('sends message body as Message', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'This is the message body',
        severity: 'info',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Message).toBe('This is the message body');
    });

    it('includes metadata in message body', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Message body',
        severity: 'error',
        metadata: {
          syncId: 'sync-123',
          consecutiveFailures: '3',
        },
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Message).toContain('Message body');
      expect(input.Message).toContain('Metadata:');
      expect(input.Message).toContain('syncId: sync-123');
      expect(input.Message).toContain('consecutiveFailures: 3');
    });

    it('includes severity in MessageAttributes', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Body',
        severity: 'warning',
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.MessageAttributes).toMatchObject({
        severity: {
          DataType: 'String',
          StringValue: 'warning',
        },
      });
    });

    it('does not include metadata section when metadata is empty', async () => {
      snsMock.on(PublishCommand).resolves({});

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Body without metadata',
        severity: 'info',
        metadata: {},
      };

      await adapter.send(message);

      const input = snsMock.calls()[0].args[0].input;
      expect(input.Message).toBe('Body without metadata');
      expect(input.Message).not.toContain('Metadata:');
    });

    it('throws when SNS publish fails', async () => {
      const error = new Error('SNS publish failed');
      snsMock.on(PublishCommand).rejects(error);

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Body',
        severity: 'error',
      };

      await expect(adapter.send(message)).rejects.toThrow('SNS publish failed');
    });
  });
});
