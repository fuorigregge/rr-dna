/**
 * Core type definitions for @repo/claude-ai
 * Centralized to ensure consistency across modules
 */

// ============================================================================
// Response Types
// ============================================================================

/**
 * Base response from Claude CLI (shared by askClaude and runClaudeCode)
 */
export interface ClaudeResponse {
  /** Response text or error description */
  result: string;
  /** API cost in USD */
  cost_usd: number;
  /** Execution time in milliseconds */
  duration_ms: number;
  /** Whether response is an error */
  is_error: boolean;
}

/**
 * Extended response for code execution (with session support)
 */
export interface RunClaudeCodeResponse extends ClaudeResponse {
  /** Claude CLI session identifier */
  session_id?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for ClaudeError
 */
export type ClaudeErrorCode =
  | 'CLI_NOT_FOUND'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_PATH'
  | 'UNKNOWN';

// ============================================================================
// Options Types
// ============================================================================

/**
 * Options for simple prompting with askClaude
 */
export interface AskClaudeOptions {
  /** Claude model to use */
  model?: string;
  /** Execution timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum number of turns (default: 10) */
  maxTurns?: number;
  /** Text appended to the CLI system prompt (--append-system-prompt) */
  appendSystemPrompt?: string;
}

/**
 * Logger interface for debugging and monitoring
 */
export interface Logger {
  debug: (message: string) => void;
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/**
 * Options for code execution with runClaudeCode
 */
export interface RunClaudeCodeOptions {
  /** Working directory (REQUIRED) - validated for security */
  cwd: string;
  /** Allowed tools whitelist. Default: ['Read', 'Glob', 'Grep', 'Edit', 'Write'] */
  allowedTools?: string[];
  /** Maximum number of turns. Default: 10 */
  maxTurns?: number;
  /** Execution timeout in milliseconds. Default: 5 minutes */
  timeoutMs?: number;
  /** Claude model to use */
  model?: string;
  /** Logger for debugging */
  logger?: Logger;
  /** Whitelist of allowed base directories for cwd validation */
  allowedBasePaths?: string[];
}

// ============================================================================
// CLI Execution Types
// ============================================================================

/**
 * Options for child_process.execFile
 */
export interface ExecFileOptions {
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Max buffer size for stdout/stderr */
  maxBuffer: number;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
}

/**
 * Result from CLI execution
 */
export interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Configuration for a Claude session
 */
export interface SessionConfig {
  /** Unique session identifier */
  id: string;
  /** When the session was created */
  createdAt: Date;
  /** When the session was last used */
  lastUsedAt: Date;
  /** Total cost accumulated in this session */
  totalCost: number;
  /** Number of turns/interactions in this session */
  turnCount: number;
}

/**
 * Metrics returned from a session
 */
export interface SessionMetrics {
  /** Total cost in USD */
  totalCost: number;
  /** Number of turns/interactions */
  turnCount: number;
  /** Duration since session creation in milliseconds */
  duration: number;
}

// ============================================================================
// LangChain Types
// ============================================================================

/**
 * Tool definition for LangChain integration
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Tool parameters schema */
  parameters?: Record<string, unknown>;
}

/**
 * Parsed tool call from Claude response
 */
export interface ParsedToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Unique call identifier */
  id: string;
}

/**
 * Options for ChatClaudeCode LangChain adapter
 */
export interface ChatClaudeCodeInput {
  /** Claude model to use */
  model?: string;
  /** Timeout in milliseconds. Default: 120000 (2 minutes) */
  timeoutMs?: number;
  /** Tool definitions (internal use) */
  tools?: ToolDefinition[];
  /** Enable debug logging */
  debug?: boolean;
}
