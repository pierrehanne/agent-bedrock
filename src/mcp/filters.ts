/**
 * Tool filtering utilities for MCP servers.
 * 
 * This module provides functions for filtering MCP tools based on
 * allowedTools and deniedTools configuration.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import type { McpTool, McpToolFilter } from './types.js';

/**
 * Filter result containing filtered tools and statistics.
 */
export interface FilterResult {
    /**
     * Filtered tools after applying allow and deny rules.
     */
    tools: McpTool[];

    /**
     * Number of tools before filtering.
     */
    originalCount: number;

    /**
     * Number of tools removed by filtering.
     */
    filteredCount: number;

    /**
     * Number of tools remaining after filtering.
     */
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
    logger?: Logger
): FilterResult {
    const originalCount = tools.length;
    let filtered = [...tools]; // Create a copy to avoid mutating input

    // Apply allowedTools filter first if specified
    if (filter.allowedTools && filter.allowedTools.length > 0) {
        const allowedSet = new Set(filter.allowedTools);
        const beforeCount = filtered.length;

        filtered = filtered.filter(tool => allowedSet.has(tool.name));

        const removedByAllow = beforeCount - filtered.length;
        if (logger && removedByAllow > 0) {
            logger.debug('Applied allowedTools filter', {
                allowedTools: filter.allowedTools,
                removedCount: removedByAllow,
                remainingCount: filtered.length,
            });
        }
    }

    // Apply deniedTools filter second if specified
    if (filter.deniedTools && filter.deniedTools.length > 0) {
        const deniedSet = new Set(filter.deniedTools);
        const beforeCount = filtered.length;

        filtered = filtered.filter(tool => !deniedSet.has(tool.name));

        const removedByDeny = beforeCount - filtered.length;
        if (logger && removedByDeny > 0) {
            logger.debug('Applied deniedTools filter', {
                deniedTools: filter.deniedTools,
                removedCount: removedByDeny,
                remainingCount: filtered.length,
            });
        }
    }

    const filteredCount = originalCount - filtered.length;
    const remainingCount = filtered.length;

    // Log summary if any tools were filtered
    if (logger && filteredCount > 0) {
        logger.info('Tool filtering applied', {
            originalCount,
            filteredCount,
            remainingCount,
            hasAllowedTools: !!(filter.allowedTools && filter.allowedTools.length > 0),
            hasDeniedTools: !!(filter.deniedTools && filter.deniedTools.length > 0),
        });
    }

    return {
        tools: filtered,
        originalCount,
        filteredCount,
        remainingCount,
    };
}

/**
 * Check if a tool filter has any filtering rules configured.
 * 
 * @param filter - Tool filter configuration
 * @returns true if filter has allowedTools or deniedTools configured
 */
export function hasFilterRules(filter?: McpToolFilter): boolean {
    if (!filter) {
        return false;
    }

    const hasAllowed = filter.allowedTools && filter.allowedTools.length > 0;
    const hasDenied = filter.deniedTools && filter.deniedTools.length > 0;

    return !!(hasAllowed || hasDenied);
}

/**
 * Validate tool filter configuration.
 * 
 * Checks for common configuration issues:
 * - Empty arrays (should be undefined instead)
 * - Duplicate tool names within a list
 * - Tool names in both allowed and denied lists
 * 
 * @param filter - Tool filter configuration to validate
 * @returns Array of validation warning messages (empty if valid)
 */
export function validateToolFilter(filter: McpToolFilter): string[] {
    const warnings: string[] = [];

    // Check for empty arrays
    if (filter.allowedTools && filter.allowedTools.length === 0) {
        warnings.push('allowedTools is an empty array (should be undefined or omitted)');
    }

    if (filter.deniedTools && filter.deniedTools.length === 0) {
        warnings.push('deniedTools is an empty array (should be undefined or omitted)');
    }

    // Check for duplicates in allowedTools
    if (filter.allowedTools && filter.allowedTools.length > 0) {
        const allowedSet = new Set(filter.allowedTools);
        if (allowedSet.size < filter.allowedTools.length) {
            warnings.push('allowedTools contains duplicate tool names');
        }
    }

    // Check for duplicates in deniedTools
    if (filter.deniedTools && filter.deniedTools.length > 0) {
        const deniedSet = new Set(filter.deniedTools);
        if (deniedSet.size < filter.deniedTools.length) {
            warnings.push('deniedTools contains duplicate tool names');
        }
    }

    // Check for tools in both allowed and denied lists
    if (
        filter.allowedTools &&
        filter.allowedTools.length > 0 &&
        filter.deniedTools &&
        filter.deniedTools.length > 0
    ) {
        const deniedSet = new Set(filter.deniedTools);
        const overlap = filter.allowedTools.filter(tool => deniedSet.has(tool));

        if (overlap.length > 0) {
            warnings.push(
                `Tools appear in both allowedTools and deniedTools: ${overlap.join(', ')} ` +
                '(these tools will be denied)'
            );
        }
    }

    return warnings;
}
