export const appRoutes = {
    search: '/search',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    archivedChats: '/chats/archived',
    tasks: '/tasks',
    activity: '/activity',
    reminders: '/reminders',
    members: '/members',
    membersHumans: '/members/humans',
    memberAgent(agentId: string) {
        return `/members/agents/${encodeURIComponent(agentId)}`;
    },
    workspace: '/workspace',
    settings: '/settings',
    settingsAgentRuntime: '/settings/agent-runtime',
    settingsAppearance: '/settings/appearance',
    settingsProfile: '/settings/profile',
    settingsUpdates: '/settings/updates',
    settingsStats: '/settings/stats',
    settingsSessions: '/settings/sessions',
    settingsSkills: '/settings/skills',
    settingsPlugins: '/settings/plugins',
    settingsChannels: '/settings/channels',
    settingsMcp: '/settings/mcp',
    settingsModels: '/settings/models',
    settingsJobs: '/settings/jobs',
} as const;
