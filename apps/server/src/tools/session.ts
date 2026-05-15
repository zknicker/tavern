import { isRecord } from './values.ts';

export function extractRelatedSessionKey(
    value: unknown,
    depth = 0,
    visited = new Set<object>()
): string | null {
    if (depth > 4) {
        return null;
    }

    if (isSessionKey(value)) {
        return value.trim();
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const match = extractRelatedSessionKey(item, depth + 1, visited);

            if (match) {
                return match;
            }
        }

        return null;
    }

    if (!isRecord(value) || visited.has(value)) {
        return null;
    }

    visited.add(value);

    for (const key of ['childSessionKey', 'sessionKey', 'targetSessionKey', 'target']) {
        const match = extractRelatedSessionKey(value[key], depth + 1, visited);

        if (match) {
            return match;
        }
    }

    for (const entryValue of Object.values(value)) {
        const match = extractRelatedSessionKey(entryValue, depth + 1, visited);

        if (match) {
            return match;
        }
    }

    return null;
}

export function isSessionKey(value: unknown): value is string {
    return typeof value === 'string' && /^agent:[^:\s]+:/.test(value.trim());
}

export function deriveAgentIdFromSessionKey(sessionKey: string | null) {
    if (!sessionKey) {
        return null;
    }

    const match = /^agent:([^:]+):/.exec(sessionKey);
    return match?.[1] ?? null;
}

export function deriveAgentRuntimeFromSessionKey(sessionKey: string | null) {
    if (!sessionKey) {
        return null;
    }

    const match = /^agent:[^:]+:([^:]+):/.exec(sessionKey);
    return match?.[1] ?? null;
}

export function formatSessionReferenceSummary(sessionKey: string | null) {
    const parts = formatSessionReferenceParts(sessionKey);
    return parts.length > 0 ? parts.join(' ') : null;
}

export function formatSessionReferenceParts(sessionKey: string | null) {
    if (!sessionKey) {
        return [];
    }

    const agentId = deriveAgentIdFromSessionKey(sessionKey);
    const runtime = deriveAgentRuntimeFromSessionKey(sessionKey);
    return [agentId, runtime ? formatAgentRuntimeLabel(runtime) : null].filter(
        (value): value is string => Boolean(value)
    );
}

export function formatSessionSpawnSummary({
    agentId,
    mode,
    runtime,
}: {
    agentId: string | null;
    mode: string | null;
    runtime: string | null;
}) {
    const parts = [mode, agentId, runtime ? formatAgentRuntimeLabel(runtime) : null].filter(
        (value): value is string => Boolean(value)
    );

    return parts.length > 0 ? parts.join(' ') : null;
}

export function formatAgentRuntimeLabel(runtime: string) {
    return runtime.toLowerCase() === 'acp' ? 'ACP' : runtime;
}

export function extractSessionKeyFromStatusText(text: string | null) {
    if (!text) {
        return null;
    }

    const match = /Session:\s+(agent:[^\s•]+)/u.exec(text);
    return match?.[1] ?? null;
}

export function formatMessageChannel(value: string | null) {
    if (!value || /^\d+$/u.test(value)) {
        return null;
    }

    return formatSessionReferenceSummary(value) ?? value;
}
