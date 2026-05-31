/**
 * @rr-dna/claude-ai - Claude Code CLI wrapper
 *
 * Provides askClaude() for single-turn prompting via the Claude CLI.
 * Uses the user's Claude subscription (not SDK/API keys).
 */

export type {
  ClaudeResponse,
  AskClaudeOptions,
  ClaudeErrorCode,
} from './core/types.js';

export { ClaudeError } from './core/errors.js';

import type { AskClaudeOptions, ClaudeResponse } from './core/types.js';
import { validateTimeout } from './core/validation.js';
import { buildAskClaudeArgs } from './cli/args-builder.js';
import { executeClaude } from './cli/executor.js';
import { parseClaudeResponse } from './cli/response-parser.js';

/**
 * Ask Claude a single-turn question via the CLI.
 *
 * @example
 * ```typescript
 * const response = await askClaude('Explain this genetic variant...');
 * console.log(response.result); // markdown response
 * ```
 */
export async function askClaude(
  prompt: string,
  options: AskClaudeOptions = {},
): Promise<ClaudeResponse> {
  const timeoutMs = validateTimeout(options.timeoutMs, 120_000);

  const args = buildAskClaudeArgs(options);

  const { stdout } = await executeClaude({
    args,
    stdin: prompt, // piped via stdin to avoid the argv size limit (E2BIG)
    execOptions: {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    },
  });

  return parseClaudeResponse(stdout);
}
