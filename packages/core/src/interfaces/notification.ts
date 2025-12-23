/**
 * Notification message for alerts
 */
export interface NotificationMessage {
  /** Subject line for the notification */
  subject: string;

  /** Main message body */
  body: string;

  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';

  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Notification abstraction for alerting.
 * Per research.md - enables cloud-agnostic core logic.
 */
export interface NotificationAdapter {
  /**
   * Send a notification
   * @param message - The notification message to send
   */
  send(message: NotificationMessage): Promise<void>;
}
