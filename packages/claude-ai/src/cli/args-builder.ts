/**
 * CLI argument builder for Claude commands
 */

import type { AskClaudeOptions, RunClaudeCodeOptions } from '../core/types.js';
import { validateMaxTurns, validateAllowedTools } from '../core/validation.js';

/**
 * Build arguments for askClaude (single-turn prompting).
 *
 * The prompt is NOT passed here: it is piped via stdin by the executor. Passing a
 * large prompt as a CLI argument hits the per-argument size limit (~128 KiB on
 * Linux) and fails with E2BIG; stdin has no such limit.
 */
export function buildAskClaudeArgs(options: AskClaudeOptions): string[] {
  const { model, maxTurns, appendSystemPrompt } = options;

  const args = [
    '-p', // print mode; the prompt is read from stdin
    '--output-format',
    'json',
    '--max-turns',
    String(maxTurns ?? 10), // Default to 10 turns for tool use
  ];

  if (model) {
    args.push('--model', model);
  }

  if (appendSystemPrompt) {
    args.push('--append-system-prompt', appendSystemPrompt);
  }

  return args;
}

/**
 * Build arguments for runClaudeCode (multi-turn code execution)
 */
export function buildRunClaudeCodeArgs(
  prompt: string,
  options: RunClaudeCodeOptions,
): string[] {
  const { model } = options;

  // Validate maxTurns and allowedTools to prevent injection/exhaustion
  const maxTurns = validateMaxTurns(options.maxTurns);
  const allowedTools = validateAllowedTools(options.allowedTools);

  const args = [
    '-p',
    prompt,
    '--output-format',
    'json',
    '--max-turns',
    String(maxTurns),
    '--allowedTools',
    allowedTools.join(','),
    '--permission-mode',
    'bypassPermissions',
  ];

  if (model) {
    args.push('--model', model);
  }

  return args;
}

/**
 * Sanitize args for logging (truncate long values)
 */
export function sanitizeArgsForLogging(args: string[], maxLength = 100): string {
  return args
    .map((arg) => (arg.length > maxLength ? arg.slice(0, maxLength) + '...' : arg))
    .join(' ');
}
