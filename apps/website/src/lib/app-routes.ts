export const appRoutes = {
    overview: '/overview',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    newChatDraft: '/chats/new',
    tasks: '/tasks',
    newTask: '/tasks/new',
    editTask(jobId: string) {
        return `/tasks/edit/${encodeURIComponent(jobId)}`;
    },
    workspace: '/workspace',
    memory: '/memory',
    settings: '/settings',
    settingsAgentRuntime: '/settings/agent-runtime',
    settingsAppearance: '/settings/appearance',
    settingsProfile: '/settings/profile',
    settingsUpdates: '/settings/updates',
    settingsStats: '/settings/stats',
    settingsSessions: '/settings/sessions',
    settingsAgent: '/settings/agent',
    settingsNotesMd: '/settings/notes-md',
    settingsSoulMd: '/settings/soul-md',
    settingsSkills: '/settings/skills',
    settingsTools: '/settings/tools',
    settingsPlugins: '/settings/plugins',
    settingsChannels: '/settings/channels',
    settingsMcp: '/settings/mcp',
    settingsModels: '/settings/models',
    settingsMemories: '/settings/memories',
    settingsJobs: '/settings/jobs',
} as const;
