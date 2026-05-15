import type { ToolAction } from './contracts.ts';
import { isRecord } from './values.ts';

function getString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isSessionKey(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }

    const normalized = value.trim();

    return (
        /^agent:[^:\s]+:/.test(normalized) ||
        /^[^:\s]+::[^:\s]+/.test(normalized) ||
        /^[^:\s]+:[^:\s]+::[^:\s]+/.test(normalized)
    );
}

function createSessionAction(input: {
    label: string;
    sessionKey: string;
    title: string;
}): ToolAction {
    return {
        kind: 'open-session',
        label: input.label,
        sessionKey: input.sessionKey,
        subtitle: input.sessionKey,
        title: input.title,
        tone: 'sky',
    };
}

function extractRelatedSessionKey(
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

function extractSessionKeyFromStatusText(text: string | null) {
    if (!text) {
        return null;
    }

    const match = /Session:\s+(agent:[^\s•]+)/u.exec(text);
    return match?.[1] ?? null;
}

function getSessionActions(value: unknown): ToolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((entry, index) => {
        if (!isRecord(entry)) {
            return [];
        }

        const sessionKey = getString(entry.key) ?? getString(entry.sessionKey);

        if (!sessionKey) {
            return [];
        }

        const title =
            getString(entry.displayName) ?? getString(entry.label) ?? `Open session ${index + 1}`;

        return [
            createSessionAction({
                label: 'Session',
                sessionKey,
                title,
            }),
        ];
    });
}

function getSubagentActions(value: unknown, label: string) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((entry, index) => {
        if (!isRecord(entry)) {
            return [];
        }

        const sessionKey = getString(entry.sessionKey);

        if (!sessionKey) {
            return [];
        }

        const title = getString(entry.label) ?? `Open ${label.toLowerCase()} ${index + 1}`;

        return [
            createSessionAction({
                label,
                sessionKey,
                title,
            }),
        ];
    });
}

export function buildToolActions(input: {
    argumentsValue: unknown;
    resultValue: unknown;
    toolName: string;
}) {
    const argumentsValue = isRecord(input.argumentsValue) ? input.argumentsValue : null;
    const resultValue = isRecord(input.resultValue) ? input.resultValue : null;

    switch (input.toolName) {
        case 'sessions_spawn': {
            const childSessionKey =
                getString(resultValue?.childSessionKey) ??
                getString(resultValue?.sessionKey) ??
                getString(argumentsValue?.sessionKey);

            return childSessionKey
                ? [
                      createSessionAction({
                          label: 'Spawned Session',
                          sessionKey: childSessionKey,
                          title: 'Open spawned session',
                      }),
                  ]
                : [];
        }
        case 'subagents': {
            const action = getString(argumentsValue?.action) ?? getString(resultValue?.action);

            if (action === 'list') {
                return [
                    ...getSubagentActions(resultValue?.active, 'Active Subagent'),
                    ...getSubagentActions(resultValue?.recent, 'Recent Subagent'),
                ];
            }

            const targetSessionKey =
                getString(resultValue?.sessionKey) ??
                getString(resultValue?.target) ??
                getString(argumentsValue?.target);

            return targetSessionKey
                ? [
                      createSessionAction({
                          label: 'Target Session',
                          sessionKey: targetSessionKey,
                          title: 'Open target subagent',
                      }),
                  ]
                : [];
        }
        case 'session_status': {
            const sessionKey = extractSessionKeyFromStatusText(getString(resultValue?.text));

            return sessionKey
                ? [
                      createSessionAction({
                          label: 'Current Session',
                          sessionKey,
                          title: 'Open current session',
                      }),
                  ]
                : [];
        }
        case 'sessions_history': {
            const sessionKey =
                getString(resultValue?.sessionKey) ?? getString(argumentsValue?.sessionKey);

            return sessionKey
                ? [
                      createSessionAction({
                          label: 'Session',
                          sessionKey,
                          title: 'Open related session',
                      }),
                  ]
                : [];
        }
        case 'sessions_list':
            return getSessionActions(resultValue?.sessions);
        default: {
            const relatedSessionKey =
                extractRelatedSessionKey(resultValue) ?? extractRelatedSessionKey(argumentsValue);

            return relatedSessionKey
                ? [
                      createSessionAction({
                          label: 'Session',
                          sessionKey: relatedSessionKey,
                          title: 'Open related session',
                      }),
                  ]
                : [];
        }
    }
}
