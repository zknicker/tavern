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

export function readAgentToolPolicyView(input: { tools: string[] }): AgentToolPolicyView {
    return {
        inheritedProfile: null,
        note: null,
        tools: normalizeToolList(input.tools),
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
