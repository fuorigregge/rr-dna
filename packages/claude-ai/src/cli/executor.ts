/**
 * CLI executor for Claude commands
 * Wraps child_process.execFile with proper error handling
 */

import { execFile } from 'node:child_process';
import type { ExecFileOptions, Logger } from '../core/types.js';
import { ClaudeError } from '../core/errors.js';
import { sanitizeArgsForLogging } from './args-builder.js';

/**
 * Options for executing Claude CLI
 */
export interface ExecuteClaudeOptions {
  /** CLI arguments */
  args: string[];
  /** execFile options */
  execOptions: ExecFileOptions;
  /** Prompt piped to the child's stdin (avoids the argv size limit / E2BIG) */
  stdin?: string;
  /** Optional logger for debugging */
  logger?: Logger;
}

/**
 * Result from Claude CLI execution
 */
export interface ExecuteClaudeResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute Claude CLI command
 *
 * @param options - Execution options
 * @returns Promise with stdout and stderr
 * @throws ClaudeError on failure
 */
export function executeClaude(
  options: ExecuteClaudeOptions,
): Promise<ExecuteClaudeResult> {
  const { args, execOptions, stdin, logger } = options;

  // Log execution details
  logger?.log(`[claude-ai] Executing: claude ${sanitizeArgsForLogging(args)}`);
  if (execOptions.cwd) {
    logger?.log(`[claude-ai] Working directory: ${execOptions.cwd}`);
  }
  logger?.log(`[claude-ai] Timeout: ${execOptions.timeout}ms`);

  return new Promise((resolve, reject) => {
    const child = execFile(
      'claude',
      args,
      {
        cwd: execOptions.cwd,
        timeout: execOptions.timeout,
        maxBuffer: execOptions.maxBuffer,
        env: execOptions.env,
      },
      (error, stdout, stderr) => {
        // Log output for debugging
        if (stderr) {
          logger?.warn(`[claude-ai] stderr: ${stderr}`);
        }
        if (stdout) {
          logger?.debug(`[claude-ai] stdout (first 1000 chars): ${stdout.slice(0, 1000)}`);
        }

        // Handle execution error
        if (error) {
          logger?.error(`[claude-ai] execFile error: ${error.message}`);
          logger?.error(
            `[claude-ai] Error details: code=${(error as NodeJS.ErrnoException).code}, killed=${error.killed}`,
          );

          // Convert to typed ClaudeError
          const claudeError = ClaudeError.fromExecError(
            error as Error & { code?: string; killed?: boolean },
            stderr,
            stdout,
            execOptions.timeout,
          );

          return reject(claudeError);
        }

        resolve({ stdout, stderr });
      },
    );

    // Pipe the prompt via stdin (avoids the argv size limit), then close it.
    if (stdin != null) {
      child.stdin?.write(stdin);
    }
    child.stdin?.end();
  });
}

/**
 * Execute Claude CLI with partial output recovery on error
 * Used for runClaudeCode where we want to recover partial results
 *
 * @param options - Execution options
 * @returns Promise with stdout, stderr, and optional error
 */
export function executeClaudeWithRecovery(
  options: ExecuteClaudeOptions,
): Promise<ExecuteClaudeResult & { error?: ClaudeError }> {
  const { args, execOptions, logger } = options;

  logger?.log(`[claude-ai] Executing: claude ${sanitizeArgsForLogging(args)}`);
  if (execOptions.cwd) {
    logger?.log(`[claude-ai] Working directory: ${execOptions.cwd}`);
  }
  logger?.log(`[claude-ai] Timeout: ${execOptions.timeout}ms`);

  return new Promise((resolve) => {
    const child = execFile(
      'claude',
      args,
      {
        cwd: execOptions.cwd,
        timeout: execOptions.timeout,
        maxBuffer: execOptions.maxBuffer,
        env: execOptions.env,
      },
      (error, stdout, stderr) => {
        if (stderr) {
          logger?.warn(`[claude-ai] stderr: ${stderr}`);
        }
        if (stdout) {
          logger?.debug(`[claude-ai] stdout (first 1000 chars): ${stdout.slice(0, 1000)}`);
        }

        if (error) {
          logger?.error(`[claude-ai] execFile error: ${error.message}`);
          logger?.error(
            `[claude-ai] Error details: code=${(error as NodeJS.ErrnoException).code}, killed=${error.killed}`,
          );

          const claudeError = ClaudeError.fromExecError(
            error as Error & { code?: string; killed?: boolean },
            stderr,
            stdout,
            execOptions.timeout,
          );

          // Return with error but include stdout for partial recovery
          resolve({ stdout, stderr, error: claudeError });
        } else {
          resolve({ stdout, stderr });
        }
      },
    );

    child.stdin?.end();
  });
}
