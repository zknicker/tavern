export const defaultAgentToolNames = [
    'read',
    'write',
    'edit',
    'apply_patch',
    'exec',
    'process',
    'web_search',
    'web_fetch',
    'memory',
    'sessions_list',
    'sessions_history',
    'sessions_send',
    'sessions_spawn',
    'subagents',
    'session_status',
];

export function buildAgentToolPolicy(tools: string[]) {
    if (tools.length === 0) {
        return {
            allow: [] as string[],
            deny: ['*'],
        };
    }

    return {
        allow: tools,
        deny: [] as string[],
        profile: 'full',
    };
}
