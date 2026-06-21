import {
    deriveProcessState,
    formatFilePathSummary,
    formatUrlHost,
    summarizeCommand,
} from './command.ts';
import type { ToolFact } from './contracts.ts';
import {
    deriveAgentIdFromSessionKey,
    deriveAgentRuntimeFromSessionKey,
    extractSessionKeyFromStatusText,
    formatAgentRuntimeLabel,
    formatMessageChannel,
    formatSessionReferenceParts,
    formatSessionSpawnSummary,
} from './session.ts';
import { getCronJobCount, isErrorStatus } from './status.ts';
import {
    formatCountLabel,
    getNumber,
    getString,
    getStringArray,
    isRecord,
    summarizeText,
} from './values.ts';

function joinLabel(parts: Array<string | null>) {
    const values = parts.filter((value): value is string => Boolean(value));
    return values.length > 0 ? values.join(' · ') : null;
}

function countRecords(value: unknown) {
    return Array.isArray(value) ? value.filter((entry) => isRecord(entry)).length : 0;
}

export function buildToolLabel(input: {
    argumentsValue: Record<string, unknown> | null;
    facts: ToolFact[];
    name: string;
    resultValue: Record<string, unknown> | null;
    status: string | null;
}) {
    const argumentsValue = input.argumentsValue;
    const resultValue = input.resultValue;

    switch (input.name) {
        case 'agents_list': {
            const count = countRecords(resultValue?.agents);
            return joinLabel(['list', formatCountLabel(count, 'agent')]);
        }
        case 'bash':
        case 'command':
        case 'exec':
        case 'shell':
        case 'terminal':
        case 'zsh': {
            const command = getString(argumentsValue?.command) ?? getString(argumentsValue?.cmd);
            const resultText = getString(resultValue?.text);
            return joinLabel([...summarizeCommand(command), deriveProcessState(resultText)]);
        }
        case 'browser': {
            const action = getString(argumentsValue?.action);
            const targetId = getString(argumentsValue?.targetId);
            const urlHost = formatUrlHost(
                getString(argumentsValue?.url) ?? getString(resultValue?.url)
            );
            const errorText = getString(resultValue?.error);
            return (
                errorText ??
                joinLabel([action, urlHost ?? (action === 'snapshot' ? targetId : null)])
            );
        }
        case 'cron': {
            const action = getString(argumentsValue?.action);

            if (action === 'list') {
                const count = getCronJobCount(resultValue?.text);
                return joinLabel(['list', formatCountLabel(count, 'job')]) ?? 'list';
            }

            return joinLabel([action, getString(resultValue?.name)]) ?? action;
        }
        case 'edit':
        case 'read':
        case 'write': {
            const filePath =
                getString(argumentsValue?.file_path) ??
                getString(argumentsValue?.filePath) ??
                getString(argumentsValue?.path);
            const pathSummary = formatFilePathSummary(filePath);
            return joinLabel([input.name, pathSummary]) ?? input.name;
        }
        case 'memory_search': {
            const query = summarizeText(getString(argumentsValue?.query));
            const count = Array.isArray(resultValue?.results) ? resultValue.results.length : null;
            return joinLabel(['search', query, formatCountLabel(count, 'result')]) ?? 'search';
        }
        case 'message': {
            const action = getString(argumentsValue?.action) ?? getString(resultValue?.action);
            const channel = formatMessageChannel(
                getString(argumentsValue?.channel) ??
                    getString(resultValue?.channel) ??
                    getString(argumentsValue?.target) ??
                    getString(resultValue?.target)
            );
            const emoji = getString(argumentsValue?.emoji) ?? getString(resultValue?.added);
            const errorText =
                getString(resultValue?.error) ??
                (isErrorStatus(input.status) ? getString(resultValue?.message) : null);

            return errorText ?? joinLabel([action, channel, action === 'react' ? emoji : null]);
        }
        case 'process': {
            const action = getString(argumentsValue?.action);
            const sessionId = getString(argumentsValue?.sessionId);
            return (
                joinLabel([action, sessionId, deriveProcessState(getString(resultValue?.text))]) ??
                action
            );
        }
        case 'session_status': {
            const sessionKey = extractSessionKeyFromStatusText(getString(resultValue?.text));
            return joinLabel(['current', ...formatSessionReferenceParts(sessionKey)]) ?? 'current';
        }
        case 'sessions_history': {
            const sessionKey =
                getString(resultValue?.sessionKey) ?? getString(argumentsValue?.sessionKey);
            const count = Array.isArray(resultValue?.messages) ? resultValue.messages.length : null;
            const errorText = getString(resultValue?.error) ?? getString(resultValue?.message);

            return (
                errorText ??
                joinLabel([
                    'history',
                    ...formatSessionReferenceParts(sessionKey),
                    formatCountLabel(count, 'message'),
                ]) ??
                'history'
            );
        }
        case 'sessions_list': {
            const kinds = getStringArray(argumentsValue?.kinds).map(formatAgentRuntimeLabel);
            const count =
                getNumber(resultValue?.count) ??
                (Array.isArray(resultValue?.sessions) ? resultValue.sessions.length : null);
            return joinLabel(['list', ...kinds, formatCountLabel(count, 'session')]);
        }
        case 'sessions_spawn': {
            const childSessionKey =
                getString(resultValue?.childSessionKey) ??
                getString(resultValue?.sessionKey) ??
                getString(argumentsValue?.sessionKey);
            const errorText = getString(resultValue?.error) ?? getString(resultValue?.errorMessage);
            const agentId =
                getString(argumentsValue?.agentId) ?? deriveAgentIdFromSessionKey(childSessionKey);
            const runtime =
                getString(argumentsValue?.runtime) ??
                deriveAgentRuntimeFromSessionKey(childSessionKey);
            const mode = getString(resultValue?.mode) ?? getString(argumentsValue?.mode);

            return (
                errorText ??
                formatSessionSpawnSummary({
                    agentId,
                    mode,
                    runtime,
                }) ??
                input.facts[0]?.value ??
                null
            );
        }
        case 'subagents': {
            const action = getString(argumentsValue?.action) ?? getString(resultValue?.action);

            if (action === 'list') {
                const activeCount = countRecords(resultValue?.active);
                const recentCount = countRecords(resultValue?.recent);

                if (activeCount > 0) {
                    return `list · ${activeCount} active`;
                }

                if (recentCount > 0) {
                    return `list · ${recentCount} recent`;
                }

                return 'list';
            }

            const targetSessionKey =
                getString(resultValue?.sessionKey) ??
                getString(resultValue?.target) ??
                getString(argumentsValue?.target);
            const targetSummary = joinLabel(formatSessionReferenceParts(targetSessionKey));

            return (
                joinLabel([action, targetSummary ?? targetSessionKey]) ??
                action ??
                targetSummary ??
                input.facts[0]?.value ??
                null
            );
        }
        case 'web_search': {
            const query = summarizeText(getString(argumentsValue?.query));
            const state = isErrorStatus(input.status) ? 'unavailable' : null;
            return joinLabel(['search', query, state]) ?? 'search';
        }
        default: {
            if (isErrorStatus(input.status)) {
                return (
                    input.facts.find((fact) => fact.tone === 'danger')?.value ??
                    input.facts[0]?.value ??
                    null
                );
            }

            const primaryFact = input.facts.find(
                (fact) =>
                    !(
                        fact.label === 'Session' &&
                        typeof fact.value === 'string' &&
                        /^agent:[^:\s]+:/.test(fact.value)
                    )
            );
            return primaryFact?.value ?? null;
        }
    }
}
