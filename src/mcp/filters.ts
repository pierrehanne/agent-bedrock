/**
 * Tool filtering utilities for MCP servers.
 *
 * This module provides functions for filtering MCP tools based on
 * allowedTools and deniedTools configuration.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import type { McpTool, McpToolFilter } from './types.js';

export interface FilterResult {
    tools: McpTool[];
    originalCount: number;
    filteredCount: number;
    remainingCount: number;
}

/**
 * Apply tool filtering rules to a list of MCP tools.
 *
 * Filtering is applied in two stages:
 * 1. If allowedTools is specified, only tools matching the list are kept
 * 2. If deniedTools is specified, tools matching the list are removed
 *
 * This allows for flexible filtering patterns:
 * - Whitelist only: specify allowedTools
 * - Blacklist only: specify deniedTools
 * - Combined: allowedTools applied first, then deniedTools
 *
 * @param tools - Array of MCP tools to filter
 * @param filter - Tool filter configuration
 * @param logger - Optional logger for observability
 * @returns Filter result with filtered tools and statistics
 *
 * @example
 * ```typescript
 * // Whitelist specific tools
 * const result1 = filterTools(tools, {
 *   allowedTools: ['get_weather', 'get_forecast']
 * });
 *
 * // Blacklist dangerous tools
 * const result2 = filterTools(tools, {
 *   deniedTools: ['delete_database', 'shutdown_server']
 * });
 *
 * // Combined filtering
 * const result3 = filterTools(tools, {
 *   allowedTools: ['get_*', 'list_*'],
 *   deniedTools: ['get_secrets']
 * });
 * ```
 */
export function filterTools(
    tools: McpTool[],
    filter: McpToolFilter,
    logger?: Logger,
): FilterResult {
    const originalCount = tools.length;
    let filtered = [...tools];

    if (filter.allowedTools?.length) {
        const allowed = new Set(filter.allowedTools);
        filtered = filtered.filter((tool) => allowed.has(tool.name));
    }

    if (filter.deniedTools?.length) {
        const denied = new Set(filter.deniedTools);
        filtered = filtered.filter((tool) => !denied.has(tool.name));
    }

    const filteredCount = originalCount - filtered.length;

    if (logger && filteredCount > 0) {
        logger.info('Tool filtering applied', {
            originalCount,
            filteredCount,
            remainingCount: filtered.length,
        });
    }

    return {
        tools: filtered,
        originalCount,
        filteredCount,
        remainingCount: filtered.length,
    };
}

// Removed: Over-engineered validation. Let runtime handle edge cases.
