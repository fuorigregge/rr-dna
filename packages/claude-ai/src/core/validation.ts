/**
 * Input validation for @repo/claude-ai
 * Includes security-critical path validation
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { ClaudeError } from './errors.js';

// Global whitelist for allowed base paths
let globalAllowedBasePaths: string[] | undefined = undefined;

/**
 * Set global whitelist of allowed base directories
 * Paths passed to runClaudeCode must be within one of these directories
 */
export function setGlobalAllowedBasePaths(paths: string[]): void {
  globalAllowedBasePaths = paths;
}

/**
 * Get the current global whitelist of allowed base directories
 */
export function getGlobalAllowedBasePaths(): string[] | undefined {
  return globalAllowedBasePaths;
}

/**
 * Clear the global whitelist (useful for testing)
 */
export function clearGlobalAllowedBasePaths(): void {
  globalAllowedBasePaths = undefined;
}

/**
 * Check for suspicious patterns using safe string operations (no ReDoS risk)
 */
function hasSuspiciousPattern(cwdPath: string): string | null {
  if (cwdPath.includes('..')) {
    return 'parent directory traversal (..)';
  }
  if (cwdPath.includes('~/')) {
    return 'home directory expansion (~/)';
  }
  if (cwdPath.includes('//')) {
    return 'double slashes (//)';
  }
  if (cwdPath.includes('\0')) {
    return 'null byte';
  }
  return null;
}

/**
 * Validates and normalizes a working directory path
 * Prevents path traversal attacks and ensures path is accessible
 *
 * @param cwdPath - The path to validate
 * @param allowedBasePaths - Optional whitelist of allowed base directories
 * @returns The validated, normalized real path
 * @throws ClaudeError with code INVALID_PATH if validation fails
 *
 * @security This function is critical for preventing directory traversal attacks:
 * 1. Rejects empty/whitespace paths
 * 2. Rejects paths with suspicious patterns (../, ~//, null bytes)
 * 3. Resolves to absolute path
 * 4. Resolves symlinks to prevent escape attacks
 * 5. Verifies path exists and is a directory
 * 6. Checks against whitelist if provided
 */
export function validateWorkingDirectory(
  cwdPath: string,
  allowedBasePaths?: string[],
): string {
  // 1. Check for empty path
  if (!cwdPath || cwdPath.trim() === '') {
    throw ClaudeError.invalidPath(cwdPath ?? '', 'Path cannot be empty');
  }

  // 2. Reject paths with suspicious patterns (using safe string operations)
  const suspiciousPattern = hasSuspiciousPattern(cwdPath);
  if (suspiciousPattern) {
    throw ClaudeError.invalidPath(
      cwdPath,
      `Contains disallowed pattern: ${suspiciousPattern}`,
    );
  }

  // 3. Resolve to absolute path
  let absolutePath: string;
  try {
    absolutePath = path.resolve(cwdPath);
  } catch (error) {
    throw ClaudeError.invalidPath(
      cwdPath,
      `Failed to resolve path: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 4. Resolve real path (follows symlinks) to prevent symlink attacks
  let realPath: string;
  try {
    realPath = fs.realpathSync(absolutePath);
  } catch (error) {
    throw ClaudeError.invalidPath(
      cwdPath,
      `Path does not exist or is not accessible: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 5. Verify it's a directory
  try {
    const stats = fs.statSync(realPath);
    if (!stats.isDirectory()) {
      throw ClaudeError.invalidPath(cwdPath, 'Path is not a directory');
    }
  } catch (error) {
    if (error instanceof ClaudeError) {
      throw error;
    }
    throw ClaudeError.invalidPath(
      cwdPath,
      `Failed to stat directory: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 6. Check against whitelist if provided
  const effectiveWhitelist = allowedBasePaths ?? globalAllowedBasePaths;
  if (effectiveWhitelist && effectiveWhitelist.length > 0) {
    // Normalize all whitelist paths
    const normalizedBasePaths: string[] = [];
    for (const basePath of effectiveWhitelist) {
      try {
        normalizedBasePaths.push(fs.realpathSync(path.resolve(basePath)));
      } catch {
        // Log warning for invalid whitelist entry
        console.warn(`[claude-ai] Invalid whitelist path ignored: ${basePath}`);
      }
    }

    // Fail-secure: if all whitelist paths are invalid, reject
    if (normalizedBasePaths.length === 0) {
      throw ClaudeError.invalidPath(
        cwdPath,
        'All whitelist paths are invalid - cannot validate security policy',
      );
    }

    // Check if realPath is within any allowed base path using path.relative
    // This is more robust than startsWith across platforms
    const isAllowed = normalizedBasePaths.some((basePath) => {
      if (realPath === basePath) return true;
      const rel = path.relative(basePath, realPath);
      // Path is allowed if relative path doesn't start with .. and is not absolute
      return !rel.startsWith('..') && !path.isAbsolute(rel);
    });

    if (!isAllowed) {
      throw ClaudeError.invalidPath(
        cwdPath,
        'Path is not within allowed directories',
      );
    }
  }

  return realPath;
}

/**
 * Validate timeout value
 * Ensures timeout is within reasonable bounds
 */
export function validateTimeout(
  timeoutMs: number | undefined,
  defaultMs: number,
  maxMs: number = 10 * 60 * 1000, // 10 minutes max
): number {
  if (timeoutMs === undefined) {
    return defaultMs;
  }

  if (typeof timeoutMs !== 'number' || isNaN(timeoutMs)) {
    return defaultMs;
  }

  // Enforce minimum of 1 second
  if (timeoutMs < 1000) {
    return 1000;
  }

  // Enforce maximum
  if (timeoutMs > maxMs) {
    return maxMs;
  }

  return timeoutMs;
}

/**
 * Validate prompt is not empty
 */
export function validatePrompt(prompt: string): void {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('Prompt cannot be empty');
  }
}

/**
 * Validate maxTurns value
 * Ensures maxTurns is within reasonable bounds to prevent resource exhaustion
 */
export function validateMaxTurns(
  maxTurns: number | undefined,
  defaultTurns: number = 10,
  maxAllowed: number = 100,
): number {
  if (maxTurns === undefined) {
    return defaultTurns;
  }

  if (typeof maxTurns !== 'number' || isNaN(maxTurns) || maxTurns < 1) {
    return defaultTurns;
  }

  return Math.min(maxTurns, maxAllowed);
}

/**
 * Known valid Claude CLI tool names
 */
const VALID_TOOL_NAMES = new Set([
  'Read',
  'Glob',
  'Grep',
  'Edit',
  'Write',
  'Bash',
  'WebFetch',
  'WebSearch',
  'Task',
  'NotebookEdit',
]);

/**
 * Validate and sanitize allowedTools array
 * Prevents tool injection via comma-containing strings
 */
export function validateAllowedTools(
  tools: string[] | undefined,
  defaultTools: string[] = ['Read', 'Glob', 'Grep', 'Edit', 'Write'],
): string[] {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return defaultTools;
  }

  // Filter to only valid tool names (alphanumeric only, no special chars)
  return tools.filter((tool) => {
    if (typeof tool !== 'string') {
      return false;
    }
    // Must be alphanumeric only
    if (!/^[A-Za-z]+$/.test(tool)) {
      console.warn(`[claude-ai] Invalid tool name ignored: ${tool}`);
      return false;
    }
    // Warn if unknown tool (but still allow it for forward compatibility)
    if (!VALID_TOOL_NAMES.has(tool)) {
      console.warn(`[claude-ai] Unknown tool name: ${tool}`);
    }
    return true;
  });
}
