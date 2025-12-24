import { describe, it, expect, vi } from 'vitest';
import {
  RetryHandler,
  calculateBackoffDelay,
} from '../../../src/services/retry-handler.js';

describe('RetryHandler', () => {
  describe('calculateBackoffDelay', () => {
    it('calculates correct delays for default values (1s, 2s, 4s)', () => {
      // FR-013: 3 retries with 1s, 2s, 4s exponential backoff
      expect(calculateBackoffDelay(1, 1000, 2)).toBe(1000); // 1s
      expect(calculateBackoffDelay(2, 1000, 2)).toBe(2000); // 2s
      expect(calculateBackoffDelay(3, 1000, 2)).toBe(4000); // 4s
    });

    it('calculates correct delays with custom initial delay', () => {
      expect(calculateBackoffDelay(1, 500, 2)).toBe(500);
      expect(calculateBackoffDelay(2, 500, 2)).toBe(1000);
      expect(calculateBackoffDelay(3, 500, 2)).toBe(2000);
    });

    it('calculates correct delays with custom multiplier', () => {
      expect(calculateBackoffDelay(1, 1000, 3)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 3)).toBe(3000);
      expect(calculateBackoffDelay(3, 1000, 3)).toBe(9000);
    });
  });

  describe('execute', () => {
    it('returns success on first attempt when operation succeeds', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const handler = new RetryHandler({}, mockSleep);
      const operation = vi.fn().mockResolvedValue('result');

      const result = await handler.execute(operation);

      expect(result).toEqual({
        success: true,
        result: 'result',
        attempts: 1,
      });
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it('retries on failure and succeeds on second attempt', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const handler = new RetryHandler({}, mockSleep);
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('result');

      const result = await handler.execute(operation);

      expect(result).toEqual({
        success: true,
        result: 'result',
        attempts: 2,
      });
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledWith(1000); // First retry delay
    });

    it('retries with exponential backoff delays (1s, 2s, 4s)', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const handler = new RetryHandler({ maxRetries: 3 }, mockSleep);
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'))
        .mockResolvedValue('result');

      const result = await handler.execute(operation);

      expect(result).toEqual({
        success: true,
        result: 'result',
        attempts: 4,
      });
      expect(mockSleep).toHaveBeenCalledTimes(3);
      expect(mockSleep).toHaveBeenNthCalledWith(1, 1000); // 1s
      expect(mockSleep).toHaveBeenNthCalledWith(2, 2000); // 2s
      expect(mockSleep).toHaveBeenNthCalledWith(3, 4000); // 4s
    });

    it('returns failure after exhausting all retries', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const handler = new RetryHandler({ maxRetries: 3 }, mockSleep);
      const errors = [
        new Error('First failure'),
        new Error('Second failure'),
        new Error('Third failure'),
        new Error('Fourth failure'),
      ];
      const operation = vi
        .fn()
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockRejectedValueOnce(errors[2])
        .mockRejectedValueOnce(errors[3]);

      const result = await handler.execute(operation);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      if (!result.success) {
        expect(result.errors).toHaveLength(4);
        expect(result.errors[0].message).toBe('First failure');
        expect(result.errors[3].message).toBe('Fourth failure');
      }
    });

    it('calls onRetry callback with correct parameters', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const onRetry = vi.fn();
      const handler = new RetryHandler({ maxRetries: 2, onRetry }, mockSleep);
      const error = new Error('Test error');
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('result');

      await handler.execute(operation);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, error, 1000);
    });

    it('handles non-Error throws by converting to Error', async () => {
      const mockSleep = vi.fn().mockResolvedValue(undefined);
      const handler = new RetryHandler({ maxRetries: 0 }, mockSleep);
      const operation = vi.fn().mockRejectedValue('string error');

      const result = await handler.execute(operation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].message).toBe('string error');
      }
    });

    it('uses default retry options when none provided', () => {
      const handler = new RetryHandler();

      expect(handler.getMaxRetries()).toBe(3);
      expect(handler.getInitialDelayMs()).toBe(1000);
      expect(handler.getBackoffMultiplier()).toBe(2);
    });

    it('accepts custom retry options', () => {
      const handler = new RetryHandler({
        maxRetries: 5,
        initialDelayMs: 500,
        backoffMultiplier: 3,
      });

      expect(handler.getMaxRetries()).toBe(5);
      expect(handler.getInitialDelayMs()).toBe(500);
      expect(handler.getBackoffMultiplier()).toBe(3);
    });
  });
});
