import type { HermesConfigOutput } from '../../lib/trpc.tsx';

type HermesConfig = NonNullable<HermesConfigOutput['snapshot']>['config'];

export interface AgentToolPolicyView {
    inheritedProfile: null | string;
    note: null | string;
    tools: string[];
}

export const coreToolOptions = [
    { id: 'read', label: 'Read', group: 'Files' },
    { id: 'write', label: 'Write', group: 'Files' },
    { id: 'edit', label: 'Edit', group: 'Files' },
    { id: 'apply_patch', label: 'Patch', group: 'Files' },
    { id: 'exec', label: 'Exec', group: 'Runtime' },
    { id: 'process', label: 'Process', group: 'Runtime' },
    { id: 'web_search', label: 'Web search', group: 'Web' },
    { id: 'web_fetch', label: 'Web fetch', group: 'Web' },
    { id: 'memory', label: 'Memory', group: 'Memory' },
    { id: 'sessions_list', label: 'Sessions list', group: 'Sessions' },
    { id: 'sessions_history', label: 'Session history', group: 'Sessions' },
    { id: 'sessions_send', label: 'Send to session', group: 'Sessions' },
    { id: 'sessions_spawn', label: 'Spawn session', group: 'Sessions' },
    { id: 'subagents', label: 'Subagents', group: 'Sessions' },
    { id: 'session_status', label: 'Status', group: 'Sessions' },
    { id: 'browser', label: 'Browser', group: 'UI' },
    { id: 'cron', label: 'Cron', group: 'Automation' },
    { id: 'gateway', label: 'Gateway', group: 'Automation' },
    { id: 'nodes', label: 'Nodes', group: 'Nodes' },
] as const;

const profileTools: Record<string, string[]> = {
    coding: [
        'read',
        'write',
        'edit',
        'apply_patch',
        'exec',
        'process',
        'code_execution',
        'web_search',
        'web_fetch',
        'x_search',
        'memory',
        'sessions_list',
        'sessions_history',
        'sessions_send',
        'sessions_spawn',
        'sessions_yield',
        'subagents',
        'session_status',
        'update_plan',
        'image',
        'image_generate',
        'music_generate',
        'video_generate',
        'bundle-mcp',
    ],
    messaging: [
        'sessions_list',
        'sessions_history',
        'sessions_send',
        'session_status',
        'message',
        'bundle-mcp',
    ],
    minimal: ['session_status'],
};

export function readAgentToolPolicyView(input: {
    agentId: string;
    config: HermesConfig | null | undefined;
}): AgentToolPolicyView {
    const agent = findAgentEntry(input.config, input.agentId);
    const agentToolsConfig = readRecord(agent?.tools);
    const hasAgentTools = Object.keys(agentToolsConfig).length > 0;
    const toolsConfig = hasAgentTools ? agentToolsConfig : readRecord(input.config?.tools);
    const sourceLabel = hasAgentTools ? 'agent' : 'global';
    const profile = readString(toolsConfig.profile);
    const allow = readStringArray(toolsConfig.allow);
    const alsoAllow = readStringArray(toolsConfig.alsoAllow);
    const deny = new Set(readStringArray(toolsConfig.deny));

    if (deny.has('*') && allow.length === 0 && alsoAllow.length === 0 && !profile) {
        return {
            inheritedProfile: null,
            note: null,
            tools: [],
        };
    }

    if (allow.length > 0) {
        return {
            inheritedProfile: null,
            note: null,
            tools: normalizeToolList(allow.filter((tool) => !deny.has(tool))),
        };
    }

    if (profile === 'full') {
        return {
            inheritedProfile: profile,
            note: `Hermes ${sourceLabel} full profile is active. Editing converts this agent to explicit tools.`,
            tools: ['*', ...alsoAllow],
        };
    }

    if (profile && profileTools[profile]) {
        return {
            inheritedProfile: profile,
            note: `Hermes ${sourceLabel} profile is active. Editing converts this agent to explicit tools.`,
            tools: normalizeToolList(
                [...profileTools[profile], ...alsoAllow].filter((tool) => !deny.has(tool))
            ),
        };
    }

    return {
        inheritedProfile: null,
        note:
            alsoAllow.length > 0
                ? `Hermes ${sourceLabel} additive tools are active. Editing converts them to explicit tools.`
                : null,
        tools: normalizeToolList(alsoAllow.filter((tool) => !deny.has(tool))),
    };
}

export function normalizeToolList(values: string[]) {
    const seen = new Set<string>();
    const tools: string[] = [];

    for (const value of values) {
        const normalized = value.trim().toLowerCase();
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        tools.push(normalized);
    }

    return tools;
}

function findAgentEntry(config: HermesConfig | null | undefined, agentId: string) {
    return readRecordArray(readRecord(config?.agents).list).find(
        (entry) => readString(entry.id) === agentId
    );
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readRecordArray(value: unknown) {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}
