export const appRoutes = {
    overview: '/overview',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    newChatDraft: '/chats/new',
    archivedChats: '/chats/archived',
    tasks: '/tasks',
    newTask: '/tasks/new',
    task(taskId: string) {
        return `/tasks/${encodeURIComponent(taskId)}`;
    },
    automations: '/automations',
    newAutomation: '/automations/new',
    editAutomation(jobId: string) {
        return `/automations/edit/${encodeURIComponent(jobId)}`;
    },
    workspace: '/workspace',
    wiki: '/wiki',
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
    settingsPlugins: '/settings/plugins',
    settingsChannels: '/settings/channels',
    settingsMcp: '/settings/mcp',
    settingsModels: '/settings/models',
    settingsMemories: '/settings/memories',
    settingsJobs: '/settings/jobs',
} as const;
