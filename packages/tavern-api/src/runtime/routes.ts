export const agentRuntimeMutationHeaders = {
    origin: 'x-tavern-origin',
} as const;

export const agentRuntimeMutationOrigins = {
    tavern: 'tavern',
    agentRuntime: 'agent-runtime',
} as const;

export const agentRuntimeRoutes = {
    agent: (id: string) => `/agents/${id}`,
    agentAppearance: (id: string) => `/agents/${id}/appearance`,
    agentConfig: (id: string) => `/agents/${id}/config`,
    agentFile: (agentId: string, path: string) =>
        `/agents/${agentId}/files/${encodeURIComponent(path)}`,
    agentFiles: (agentId: string) => `/agents/${agentId}/files`,
    agentModel: (id: string) => `/agents/${id}/model`,
    agentName: (id: string) => `/agents/${id}/name`,
    agentThinkingDefault: (id: string) => `/agents/${id}/thinking-default`,
    agentTools: (id: string) => `/agents/${id}/tools`,
    agents: '/agents',
    capabilities: '/capabilities',
    capability: (id: string) => `/capabilities/${encodeURIComponent(id)}`,
    capabilityRefresh: (id: string) => `/capabilities/${encodeURIComponent(id)}/refresh`,
    capabilitiesRefresh: '/capabilities/refresh',
    commands: '/commands',
    commandsRun: '/commands/run',
    update: '/update',
    updateRestart: '/update/restart',
    updateStatus: '/update/status',
    macApps: '/mac-apps',
    modelAccess: '/model-access',
    modelAccessApiKey: '/model-access/api-key',
    modelAccessOAuthCancel: (sessionId: string) =>
        `/model-access/oauth/sessions/${encodeURIComponent(sessionId)}`,
    modelAccessOAuthPoll: (providerId: string, sessionId: string) =>
        `/model-access/oauth/${encodeURIComponent(providerId)}/poll/${encodeURIComponent(sessionId)}`,
    modelAccessOAuthStart: (providerId: string) =>
        `/model-access/oauth/${encodeURIComponent(providerId)}/start`,
    modelAccessOAuthSubmit: (providerId: string) =>
        `/model-access/oauth/${encodeURIComponent(providerId)}/submit`,
    modelAccessOpenAiSettings: '/model-access/openai',
    modelAccessOpenRouterSettings: '/model-access/openrouter',
    connector: (id: string) => `/connectors/${encodeURIComponent(id)}`,
    connectorTest: (id: string) => `/connectors/${encodeURIComponent(id)}/test`,
    connectors: '/connectors',
    executionSettings: '/execution-settings',
    permissionSettings: '/permission-settings',
    job: (slug: string) => `/jobs/${encodeURIComponent(slug)}`,
    jobRun: (slug: string) => `/jobs/${encodeURIComponent(slug)}/run`,
    jobs: '/jobs',
    hermesConfig: '/hermes-config',
    cronJob: (id: string) => `/cron-jobs/${id}`,
    cronJobs: '/cron-jobs',
    cronJobRun: (id: string) => `/cron-jobs/${id}/run`,
    cronJobRuns: (id: string) => `/cron-jobs/${id}/runs`,
    cronRun: (id: string) => `/cron-runs/${id}`,
    cronRuns: '/cron-runs',
    events: '/events',
    chatSocket: '/chat',
    highlights: '/highlights',
    chatMessages: (chatId: string) => `/hermes/chats/${chatId}/messages`,
    chatTurnStop: (chatId: string, runId: string) =>
        `/hermes/chats/${encodeURIComponent(chatId)}/turns/${encodeURIComponent(runId)}/stop`,
    chats: '/hermes/chats',
    cortexBacklinks: (topic: string, pagePath: string) =>
        `/cortex/topics/${encodeURIComponent(topic)}/pages/${encodeURIComponent(pagePath)}/backlinks`,
    cortexPage: (topic: string, pagePath: string) =>
        `/cortex/topics/${encodeURIComponent(topic)}/pages/${encodeURIComponent(pagePath)}`,
    cortexHealth: '/cortex/health',
    cortexPages: '/cortex/pages',
    cortexSearch: '/cortex/search',
    cortexStatus: '/cortex/status',
    cortexTopics: '/cortex/topics',
    health: '/health',
    workspaceAgentInstructions: (agentId: string) =>
        `/workspace/agents/${encodeURIComponent(agentId)}/instructions`,
    models: '/models',
    binding: (id: string) => `/bindings/${id}`,
    bindings: '/bindings',
    discordBinding: (id: string) => `/bindings/discord/${encodeURIComponent(id)}`,
    discordBindings: '/bindings/discord',
    skillEnabled: (id: string) => `/skills/${id}/enabled`,
    skills: '/skills',
    toolsetEnabled: (id: string) => `/toolsets/${encodeURIComponent(id)}/enabled`,
    toolsets: '/toolsets',
    sessionApprovalRespond: (sessionKey: string) =>
        `/hermes/sessions/${encodeURIComponent(sessionKey)}/approval`,
    sessionClarificationRespond: (sessionKey: string) =>
        `/hermes/sessions/${encodeURIComponent(sessionKey)}/clarification`,
    sessionGraph: (sessionKey: string) => `/hermes/sessions/${sessionKey}/graph`,
    sessionMessages: (sessionKey: string) => `/hermes/sessions/${sessionKey}/messages`,
    sessionPrompt: (sessionKey: string) => `/hermes/sessions/${sessionKey}/prompt`,
    sessionPreviews: '/hermes/sessions/previews',
    sessionResync: (sessionKey: string) => `/hermes/sessions/${sessionKey}/resync`,
    sessions: '/hermes/sessions',
} as const;
