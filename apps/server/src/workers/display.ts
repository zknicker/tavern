import type { AgentLookup } from '../participants/observed.ts';

interface WorkerDisplayInput {
    agentId: string | null;
    childSessionKey: string | null;
    description: string | null;
    error: string | null;
    kind: 'acp' | 'subagent' | 'cron' | 'cli';
    progressSummary: string | null;
    requesterSessionKey: string | null;
    sessionKey: string | null;
    terminalSummary: string | null;
    title: string;
}

export interface WorkerDisplayContext {
    agentLookup: AgentLookup;
    chatTitleBySessionKey: ReadonlyMap<string, string>;
}

export interface WorkerDisplay {
    agentName: string;
    chatTitle: string | null;
    detail: string | null;
    sessionKey: string | null;
    title: string;
}

function normalizeText(value: string | null | undefined) {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
}

function sentenceCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function deriveAgentIdFromSessionKey(sessionKey: string | null) {
    const normalized = sessionKey?.trim() ?? '';
    const match = /^agent:([^:]+):/.exec(normalized);
    return match?.[1] ?? null;
}

function buildFallbackAgentName(agentId: string | null) {
    return agentId ? sentenceCase(agentId) : 'Agent';
}

function extractTaskText(description: string | null) {
    if (!description) {
        return null;
    }

    const subagentTaskMatch = /^\[Subagent Task\]:\s*(.+)$/mu.exec(description);

    if (subagentTaskMatch?.[1]) {
        return normalizeText(subagentTaskMatch[1]);
    }

    const internalTaskMatch = /^\s*task:\s*(.+)$/mu.exec(description);

    if (internalTaskMatch?.[1]) {
        return normalizeText(internalTaskMatch[1]);
    }

    if (!(description.includes('\n') || description.startsWith('['))) {
        return description;
    }

    return null;
}

function isSubagentCompletionAnnouncement(description: string | null) {
    return (
        description?.includes('[Internal task completion event]') === true &&
        description.includes('source: subagent')
    );
}

function isSubagentAgentRuntimeTask(description: string | null) {
    return description?.includes('[Subagent Context]') === true;
}

function resolveWorkerSessionKey(input: WorkerDisplayInput) {
    return (
        normalizeText(input.sessionKey) ??
        normalizeText(input.childSessionKey) ??
        normalizeText(input.requesterSessionKey)
    );
}

function resolveAgentName(input: WorkerDisplayInput, context: WorkerDisplayContext) {
    const agentId =
        normalizeText(input.agentId) ??
        deriveAgentIdFromSessionKey(normalizeText(input.requesterSessionKey)) ??
        deriveAgentIdFromSessionKey(resolveWorkerSessionKey(input)) ??
        deriveAgentIdFromSessionKey(normalizeText(input.childSessionKey));

    return (
        context.agentLookup.byId.get(agentId ?? '')?.displayName ?? buildFallbackAgentName(agentId)
    );
}

function resolveChatTitle(input: WorkerDisplayInput, context: WorkerDisplayContext) {
    const sessionKeys = [
        normalizeText(input.requesterSessionKey),
        resolveWorkerSessionKey(input),
        normalizeText(input.childSessionKey),
    ].filter((value): value is string => value !== null);

    for (const sessionKey of sessionKeys) {
        const chatTitle = context.chatTitleBySessionKey.get(sessionKey);

        if (chatTitle) {
            return chatTitle;
        }
    }

    return null;
}

function buildTitle(
    input: WorkerDisplayInput,
    agentName: string,
    chatTitle: string | null,
    description: string | null
) {
    let headline: string;

    switch (input.kind) {
        case 'subagent':
            headline = 'Spawned a subagent';
            break;
        case 'cli':
            headline = isSubagentCompletionAnnouncement(description)
                ? 'Delivered a subagent result'
                : isSubagentAgentRuntimeTask(description)
                  ? 'Ran a subagent task'
                  : 'Ran a CLI task';
            break;
        case 'acp':
            headline = 'Ran an ACP task';
            break;
        case 'cron': {
            const cronTitle =
                extractTaskText(description) ?? normalizeText(input.title) ?? 'a cron task';
            headline = `Ran ${cronTitle}`;
            break;
        }
    }

    return `(${agentName}) ${headline}${chatTitle ? ` in ${chatTitle}` : ''}.`;
}

function buildDetail(input: WorkerDisplayInput, description: string | null) {
    const taskText = extractTaskText(description);
    const error = normalizeText(input.error);
    const progressSummary = normalizeText(input.progressSummary);
    const terminalSummary = normalizeText(input.terminalSummary);

    if (error) {
        return error;
    }

    return taskText ?? progressSummary ?? terminalSummary ?? null;
}

export function buildWorkerDisplay(
    input: WorkerDisplayInput,
    context: WorkerDisplayContext
): WorkerDisplay {
    const description = normalizeText(input.description);
    const agentName = resolveAgentName(input, context);
    const chatTitle = resolveChatTitle(input, context);

    return {
        agentName,
        chatTitle,
        detail: buildDetail(input, description),
        sessionKey: resolveWorkerSessionKey(input),
        title: buildTitle(input, agentName, chatTitle, description),
    };
}
