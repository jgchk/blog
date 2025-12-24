/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Optional callback called before each retry */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Result of a retry operation
 */
export type RetryResult<T> =
  | { success: true; result: T; attempts: number }
  | { success: false; errors: Error[]; attempts: number };

/**
 * Delay helper for exponential backoff.
 * Calculates delay as: initialDelay * multiplier^(attempt - 1)
 * For default values: 1000ms, 2000ms, 4000ms (1s, 2s, 4s)
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number = 1000,
  multiplier: number = 2
): number {
  return initialDelayMs * Math.pow(multiplier, attempt - 1);
}

/**
 * Sleep for a specified number of milliseconds.
 * Can be overridden in tests by passing a mock.
 */
export async function sleep(
  ms: number,
  sleepFn: (ms: number) => Promise<void> = defaultSleep
): Promise<void> {
  return sleepFn(ms);
}

/**
 * Default sleep implementation
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry handler with exponential backoff.
 * Per FR-013: 3 retries with 1s, 2s, 4s exponential backoff.
 */
export class RetryHandler {
  private options: Required<Omit<RetryOptions, 'onRetry'>> & Pick<RetryOptions, 'onRetry'>;
  private sleepFn: (ms: number) => Promise<void>;

  constructor(options?: RetryOptions, sleepFn?: (ms: number) => Promise<void>) {
    this.options = {
      maxRetries: options?.maxRetries ?? 3,
      initialDelayMs: options?.initialDelayMs ?? 1000,
      backoffMultiplier: options?.backoffMultiplier ?? 2,
      onRetry: options?.onRetry,
    };
    this.sleepFn = sleepFn ?? defaultSleep;
  }

  /**
   * Execute an operation with retry logic
   * @param operation - The async operation to execute
   * @returns RetryResult with success/failure and attempt count
   */
  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const errors: Error[] = [];
    let attempts = 0;

    while (attempts <= this.options.maxRetries) {
      attempts++;

      try {
        const result = await operation();
        return { success: true, result, attempts };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);

        // If we've exhausted retries, return failure
        if (attempts > this.options.maxRetries) {
          break;
        }

        // Calculate delay for next retry
        const delayMs = calculateBackoffDelay(
          attempts,
          this.options.initialDelayMs,
          this.options.backoffMultiplier
        );

        // Call retry callback if provided
        if (this.options.onRetry) {
          this.options.onRetry(attempts, error, delayMs);
        }

        // Wait before retrying
        await sleep(delayMs, this.sleepFn);
      }
    }

    return { success: false, errors, attempts };
  }

  /**
   * Get the configured max retries
   */
  getMaxRetries(): number {
    return this.options.maxRetries;
  }

  /**
   * Get the configured initial delay
   */
  getInitialDelayMs(): number {
    return this.options.initialDelayMs;
  }

  /**
   * Get the configured backoff multiplier
   */
  getBackoffMultiplier(): number {
    return this.options.backoffMultiplier;
  }
}
