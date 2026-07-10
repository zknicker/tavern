import type { AgentRuntimeTool } from '@tavern/api';
import { listPluginToolGroups } from '../plugins/agent-capabilities.ts';

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
    {
        configured: true,
        description: 'Read current Tavern chat messages by sequence, search text, or message id.',
        enabled: true,
        id: 'chat_messages',
        label: 'Chat messages',
        name: 'chat_messages',
        readOnly: true,
        tools: ['chat_messages_list', 'chat_messages_search', 'chat_message_get'],
    },
    {
        configured: true,
        description: 'List your chats and post a message into another chat you participate in.',
        enabled: true,
        id: 'chat_actions',
        label: 'Chat actions',
        name: 'chat_actions',
        readOnly: false,
        tools: ['chats_list', 'chat_send'],
    },
    {
        configured: true,
        description: 'Browse, search, and update shared Wiki pages.',
        enabled: true,
        id: 'wiki',
        label: 'Wiki',
        name: 'wiki',
        readOnly: false,
        tools: [
            'wiki_list',
            'wiki_search',
            'wiki_read',
            'wiki_write',
            'wiki_backlinks',
            'wiki_move',
            'wiki_delete',
        ],
    },
] satisfies AgentRuntimeTool[];

export function listRuntimeTools() {
    return { tools: [...builtInTools.map((tool) => ({ ...tool })), ...listPluginToolGroups()] };
}

export function getRuntimeTool(toolId: string) {
    const tool = [...builtInTools, ...listPluginToolGroups()].find(
        (candidate) => candidate.id === toolId
    );
    return tool ? { ...tool } : null;
}
