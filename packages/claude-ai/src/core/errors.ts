/**
 * Error handling for @repo/claude-ai
 * Provides typed errors with factory methods
 */

import type { ClaudeErrorCode } from './types.js';

/**
 * Custom error class for Claude CLI operations
 */
export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly code: ClaudeErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ClaudeError';

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClaudeError);
    }
  }

  /**
   * Create error for CLI not found (ENOENT)
   */
  static cliNotFound(cause?: unknown): ClaudeError {
    return new ClaudeError(
      'Claude CLI not found. Ensure "claude" is installed and in PATH.',
      'CLI_NOT_FOUND',
      cause,
    );
  }

  /**
   * Create error for execution timeout
   */
  static timeout(timeoutMs: number, cause?: unknown): ClaudeError {
    return new ClaudeError(
      `Claude CLI timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      cause,
    );
  }

  /**
   * Create error for authentication failure
   */
  static authError(cause?: unknown): ClaudeError {
    return new ClaudeError(
      'Claude CLI authentication error. Run "claude login" to authenticate.',
      'AUTH_ERROR',
      cause,
    );
  }

  /**
   * Create error for JSON parse failure
   */
  static parseError(output: string, cause?: unknown): ClaudeError {
    const preview = output.slice(0, 500);
    return new ClaudeError(
      `Failed to parse Claude CLI output: ${preview}${output.length > 500 ? '...' : ''}`,
      'PARSE_ERROR',
      cause,
    );
  }

  /**
   * Create error for invalid path (path traversal prevention)
   */
  static invalidPath(path: string, reason: string): ClaudeError {
    return new ClaudeError(
      `Invalid path "${path}": ${reason}`,
      'INVALID_PATH',
    );
  }

  /**
   * Create error for unknown/generic failures
   */
  static unknown(message: string, cause?: unknown): ClaudeError {
    return new ClaudeError(
      `Claude CLI error: ${message}`,
      'UNKNOWN',
      cause,
    );
  }

  /**
   * Create error from execFile error with context
   */
  static fromExecError(
    error: Error & { code?: string; killed?: boolean },
    stderr?: string,
    stdout?: string,
    timeoutMs?: number,
  ): ClaudeError {
    // Check for CLI not found
    if (error.code === 'ENOENT') {
      return ClaudeError.cliNotFound(error);
    }

    // Check for timeout
    if (error.killed || error.message?.includes('TIMEOUT')) {
      return ClaudeError.timeout(timeoutMs ?? 0, error);
    }

    // Check for auth error
    if (stderr?.includes('auth') || stderr?.includes('login')) {
      return ClaudeError.authError(error);
    }

    // Build detailed error message
    const details: string[] = [error.message];
    if (stderr) {
      details.push(`stderr: ${stderr.slice(0, 500)}`);
    }
    if (stdout) {
      details.push(`stdout: ${stdout.slice(0, 500)}`);
    }

    return ClaudeError.unknown(details.join('\n'), error);
  }
}
