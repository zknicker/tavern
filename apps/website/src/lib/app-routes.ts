export const appRoutes = {
    search: '/search',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    archivedChats: '/chats/archived',
    tasks: '/tasks',
    newTask: '/tasks/new',
    task(taskId: string) {
        return `/tasks/${encodeURIComponent(taskId)}`;
    },
    activity: '/activity',
    reminders: '/reminders',
    newReminder: '/reminders/new',
    editReminder(jobId: string) {
        return `/reminders/edit/${encodeURIComponent(jobId)}`;
    },
    members: '/members',
    memberAgent(agentId: string) {
        return `/members/agents/${encodeURIComponent(agentId)}`;
    },
    designBrief: '/design/brief',
    workspace: '/workspace',
    wiki: '/wiki',
    settings: '/settings',
    settingsAgentRuntime: '/settings/agent-runtime',
    settingsAppearance: '/settings/appearance',
    settingsProfile: '/settings/profile',
    settingsMembers: '/settings/members',
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
