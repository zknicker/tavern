import type { AgentRuntimeTool } from '@tavern/api';

const builtInTools = [
    {
        configured: true,
        description: 'Run shell commands inside the agent workspace.',
        enabled: true,
        id: 'bash',
        label: 'Bash',
        name: 'bash',
        readOnly: true,
        tools: ['bash'],
    },
    {
        configured: true,
        description: 'Read UTF-8 files from the agent workspace.',
        enabled: true,
        id: 'read_file',
        label: 'Read file',
        name: 'read_file',
        readOnly: true,
        tools: ['read_file'],
    },
] satisfies AgentRuntimeTool[];

export function listRuntimeTools() {
    return { tools: builtInTools.map((tool) => ({ ...tool })) };
}

export function getRuntimeTool(toolId: string) {
    const tool = builtInTools.find((candidate) => candidate.id === toolId);
    return tool ? { ...tool } : null;
}
