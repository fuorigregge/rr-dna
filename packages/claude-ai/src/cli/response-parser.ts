/**
 * Response parsing for Claude CLI output
 */

import type {
  ClaudeResponse,
  RunClaudeCodeResponse,
  Logger,
} from '../core/types.js';
import { ClaudeError } from '../core/errors.js';

/**
 * Parse response from askClaude (simple prompting)
 */
export function parseClaudeResponse(stdout: string): ClaudeResponse {
  try {
    const parsed = JSON.parse(stdout);

    return {
      result: parsed.result ?? '',
      cost_usd: parsed.cost_usd ?? parsed.total_cost_usd ?? 0,
      duration_ms: parsed.duration_ms ?? 0,
      is_error: parsed.is_error ?? false,
    };
  } catch (parseError) {
    throw ClaudeError.parseError(stdout, parseError);
  }
}

/**
 * Parse response from runClaudeCode (code execution)
 */
export function parseRunClaudeCodeResponse(
  stdout: string,
  logger?: Logger,
): RunClaudeCodeResponse {
  try {
    const parsed = JSON.parse(stdout);
    const cost = parsed.cost_usd ?? parsed.total_cost_usd ?? 0;

    logger?.log(
      `[claude-ai] Successfully parsed response. is_error=${parsed.is_error}, cost=${cost}`,
    );

    return {
      result: parsed.result ?? '',
      cost_usd: cost,
      duration_ms: parsed.duration_ms ?? 0,
      is_error: parsed.is_error ?? false,
      session_id: parsed.session_id,
    };
  } catch (parseError) {
    logger?.error(`[claude-ai] JSON parse error: ${parseError}`);
    logger?.error(`[claude-ai] Raw stdout: ${stdout.slice(0, 1000)}`);
    throw ClaudeError.parseError(stdout, parseError);
  }
}

/**
 * Attempt to parse partial response from stdout when execution failed
 * Returns null if parsing fails
 */
export function parsePartialResponse(
  stdout: string,
  logger?: Logger,
): RunClaudeCodeResponse | null {
  if (!stdout || stdout.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(stdout);
    logger?.log(`[claude-ai] Parsed partial output despite error`);

    return {
      result: parsed.result ?? '',
      cost_usd: parsed.cost_usd ?? parsed.total_cost_usd ?? 0,
      duration_ms: parsed.duration_ms ?? 0,
      is_error: true, // Mark as error since this came from error path
      session_id: parsed.session_id,
    };
  } catch {
    logger?.debug?.(`[claude-ai] Failed to parse stdout as JSON`);
    return null;
  }
}
