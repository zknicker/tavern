import {
    type AgentRuntimeAgent,
    type AgentRuntimeAgentEngineConfigSnapshot,
    type AgentRuntimeAgentEnv,
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    type AgentRuntimeAgentPluginGrant,
    type AgentRuntimeAgentPluginGrantList,
    type AgentRuntimeApplyAgentEngineConfig,
    type AgentRuntimeArchiveAgent,
    type AgentRuntimeArchiveBinding,
    type AgentRuntimeArchiveCron,
    type AgentRuntimeBinding,
    type AgentRuntimeCancelModelProviderOAuth,
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeCapabilityHealthId,
    type AgentRuntimeCapabilityHealthList,
    type AgentRuntimeChat,
    type AgentRuntimeCompleteGoogleOAuth,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateCron,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeCreateTask,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeCronRun,
    type AgentRuntimeCurrentAgentSessionResult,
    type AgentRuntimeDeleteDiscordBinding,
    type AgentRuntimeDiscordBinding,
    type AgentRuntimeEventList,
    type AgentRuntimeGoogleCalendarEventsList,
    type AgentRuntimeGoogleCalendarEventsListInput,
    type AgentRuntimeGoogleOAuthPoll,
    type AgentRuntimeGoogleOAuthPollInput,
    type AgentRuntimeGoogleOAuthStart,
    type AgentRuntimeGoogleSettings,
    type AgentRuntimeJobDetail,
    type AgentRuntimeJobList,
    type AgentRuntimeJobSlug,
    type AgentRuntimeMacAppList,
    type AgentRuntimeMcpCatalog,
    type AgentRuntimeMcpCatalogInstall,
    type AgentRuntimeMcpServer,
    type AgentRuntimeMcpServerCreate,
    type AgentRuntimeMcpServerList,
    type AgentRuntimeMcpServerTestResult,
    type AgentRuntimeMemorySettings,
    type AgentRuntimeMerchbaseActionInput,
    type AgentRuntimeMerchbaseActionResult,
    type AgentRuntimeMerchbaseSalesSeries,
    type AgentRuntimeMerchbaseSalesSeriesInput,
    type AgentRuntimeMerchbaseSettings,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeModelAccess,
    type AgentRuntimeModelCategorySettings,
    type AgentRuntimeModelProviderCatalog,
    type AgentRuntimeModelProviderCatalogEntry,
    type AgentRuntimeModelProviderEnabled,
    type AgentRuntimeModels,
    type AgentRuntimeOpenAiSettings,
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimePlugin,
    type AgentRuntimePluginId,
    type AgentRuntimePluginList,
    type AgentRuntimePollModelProviderOAuth,
    type AgentRuntimeRenderedWorkspaceInstructions,
    type AgentRuntimeResetAgentSession,
    type AgentRuntimeResetAgentSessionResult,
    type AgentRuntimeRunCron,
    type AgentRuntimeRunJob,
    type AgentRuntimeRunJobInput,
    type AgentRuntimeSaveAgentEnv,
    type AgentRuntimeSaveAgentEnvResult,
    type AgentRuntimeSaveAgentFile,
    type AgentRuntimeSaveDiscordBinding,
    type AgentRuntimeSaveGoogleSettings,
    type AgentRuntimeSaveMemorySettings,
    type AgentRuntimeSaveMemorySettingsResult,
    type AgentRuntimeSaveMerchbaseSettings,
    type AgentRuntimeSaveModelCategorySettings,
    type AgentRuntimeSaveModelCategorySettingsResult,
    type AgentRuntimeSaveModelProviderApiKey,
    type AgentRuntimeSaveOpenAiSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveSemanticMemorySettings,
    type AgentRuntimeSaveSemanticMemorySettingsResult,
    type AgentRuntimeSaveTimezoneSettings,
    type AgentRuntimeSaveTimezoneSettingsResult,
    type AgentRuntimeSaveWorkspaceInstructions,
    type AgentRuntimeSemanticMemorySettings,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionList,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPreviewList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeSkillHubAvailable,
    type AgentRuntimeSkillHubInstallInput,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    type AgentRuntimeSkillHubTap,
    type AgentRuntimeSkillHubTapList,
    type AgentRuntimeSkillHubUninstallInput,
    type AgentRuntimeSkillResetResult,
    type AgentRuntimeSkillSummary,
    type AgentRuntimeStartGoogleOAuth,
    type AgentRuntimeStartModelProviderOAuth,
    type AgentRuntimeSteerTurn,
    type AgentRuntimeSteerTurnResult,
    type AgentRuntimeStopTurn,
    type AgentRuntimeStopTurnResult,
    type AgentRuntimeSubmitModelProviderOAuth,
    type AgentRuntimeTimezoneSettings,
    type AgentRuntimeTool,
    type AgentRuntimeToolConfig,
    type AgentRuntimeToolEnvUpdate,
    type AgentRuntimeToolEnvUpdateResult,
    type AgentRuntimeToolList,
    type AgentRuntimeToolPostSetup,
    type AgentRuntimeToolProviderSelect,
    type AgentRuntimeToolProviderSelectResult,
    type AgentRuntimeUpdate,
    type AgentRuntimeUpdateAgentModel,
    type AgentRuntimeUpdateAgentName,
    type AgentRuntimeUpdateAgentPluginGrant,
    type AgentRuntimeUpdateAgentSessionModel,
    type AgentRuntimeUpdateAgentSessionModelResult,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeTask,
    type AgentRuntimeTaskList,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpdateModelProvider,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateTask,
    type AgentRuntimeUpdateToolEnabled,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeWorkspaceFileContent,
    type AgentRuntimeWorkspaceFileList,
    type AgentRuntimeWorkspaceFileListInput,
    type AgentRuntimeWorkspaceInstructions,
    agentRuntimeAgentEngineConfigSnapshotSchema,
    agentRuntimeAgentEnvSchema,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentPluginGrantListSchema,
    agentRuntimeAgentPluginGrantSchema,
    agentRuntimeAgentSchema,
    agentRuntimeApplyAgentEngineConfigSchema,
    agentRuntimeArchiveAgentSchema,
    agentRuntimeArchiveBindingSchema,
    agentRuntimeArchiveCronSchema,
    agentRuntimeBindingListSchema,
    agentRuntimeBindingSchema,
    agentRuntimeCancelModelProviderOAuthSchema,
    agentRuntimeCapabilityHealthIdSchema,
    agentRuntimeCapabilityHealthListSchema,
    agentRuntimeCapabilityHealthSchema,
    agentRuntimeChatListSchema,
    agentRuntimeCompleteGoogleOAuthSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCreateTaskSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeDeleteDiscordBindingSchema,
    agentRuntimeDiscordBindingListSchema,
    agentRuntimeErrorSchema,
    agentRuntimeGoogleCalendarEventsListInputSchema,
    agentRuntimeGoogleCalendarEventsListSchema,
    agentRuntimeGoogleOAuthPollInputSchema,
    agentRuntimeGoogleOAuthPollSchema,
    agentRuntimeGoogleOAuthStartSchema,
    agentRuntimeGoogleSettingsSchema,
    agentRuntimeJobDetailSchema,
    agentRuntimeJobListSchema,
    agentRuntimeJobSlugSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMcpCatalogInstallSchema,
    agentRuntimeMcpCatalogSchema,
    agentRuntimeMcpServerCreateSchema,
    agentRuntimeMcpServerListSchema,
    agentRuntimeMcpServerSchema,
    agentRuntimeMcpServerTestResultSchema,
    agentRuntimeMemorySettingsSchema,
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeModelAccessSchema,
    agentRuntimeModelCategorySettingsSchema,
    agentRuntimeModelProviderCatalogEntrySchema,
    agentRuntimeModelProviderCatalogSchema,
    agentRuntimeModelProviderEnabledSchema,
    agentRuntimeModelProviderOAuthCancelSchema,
    agentRuntimeModelProviderOAuthPollSchema,
    agentRuntimeModelProviderOAuthStartSchema,
    agentRuntimeModelProviderOAuthSubmitSchema,
    agentRuntimeModelsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeOpenAiSettingsSchema,
    agentRuntimeOpenRouterSettingsSchema,
    agentRuntimePluginIdSchema,
    agentRuntimePluginListSchema,
    agentRuntimePluginSchema,
    agentRuntimePollModelProviderOAuthSchema,
    agentRuntimeRenderedWorkspaceInstructionsSchema,
    agentRuntimeResetAgentSessionResultSchema,
    agentRuntimeResetAgentSessionSchema,
    agentRuntimeRoutes,
    agentRuntimeRunCronSchema,
    agentRuntimeRunJobInputSchema,
    agentRuntimeRunJobSchema,
    agentRuntimeSaveAgentEnvResultSchema,
    agentRuntimeSaveAgentEnvSchema,
    agentRuntimeSaveAgentFileSchema,
    agentRuntimeSaveDiscordBindingSchema,
    agentRuntimeSaveGoogleSettingsSchema,
    agentRuntimeSaveMemorySettingsResultSchema,
    agentRuntimeSaveMemorySettingsSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
    agentRuntimeSaveModelCategorySettingsResultSchema,
    agentRuntimeSaveModelCategorySettingsSchema,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSaveOpenAiSettingsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveSemanticMemorySettingsResultSchema,
    agentRuntimeSaveSemanticMemorySettingsSchema,
    agentRuntimeSaveTimezoneSettingsResultSchema,
    agentRuntimeSaveTimezoneSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
    agentRuntimeSemanticMemorySettingsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPreviewListSchema,
    agentRuntimeSessionPromptSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubInstallInputSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
    agentRuntimeSkillHubTapListSchema,
    agentRuntimeSkillHubTapSchema,
    agentRuntimeSkillHubUninstallInputSchema,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillResetResultSchema,
    agentRuntimeSkillSchema,
    agentRuntimeStartGoogleOAuthSchema,
    agentRuntimeStartModelProviderOAuthSchema,
    agentRuntimeSteerTurnResultSchema,
    agentRuntimeSteerTurnSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
    agentRuntimeTaskListSchema,
    agentRuntimeTaskSchema,
    agentRuntimeTimezoneSettingsSchema,
    agentRuntimeToolConfigSchema,
    agentRuntimeToolEnvUpdateResultSchema,
    agentRuntimeToolEnvUpdateSchema,
    agentRuntimeToolListSchema,
    agentRuntimeToolPostSetupSchema,
    agentRuntimeToolProviderSelectResultSchema,
    agentRuntimeToolProviderSelectSchema,
    agentRuntimeToolSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentPluginGrantSchema,
    agentRuntimeUpdateAgentSessionModelResultSchema,
    agentRuntimeUpdateAgentSessionModelSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateCronSchema,
    agentRuntimeUpdateModelProviderSchema,
    agentRuntimeUpdateTaskSchema,
    agentRuntimeUpdateSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolEnabledSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeWorkspaceFileContentSchema,
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFileListSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    type MemoryDreamResult,
    type MemoryJobDetail,
    type MemoryJobKind,
    type MemoryJobList,
    type MemoryJobStatus,
    type MemoryWorkerStatusList,
    memoryDreamResultSchema,
    memoryJobDetailSchema,
    memoryJobListSchema,
    memoryPathInputSchema,
    memoryPathMutationResultSchema,
    memoryWorkerStatusListSchema,
    runtimeEventListSchema,
    type SemanticMemoryBacklinkList,
    type SemanticMemoryCreatePage,
    type SemanticMemoryMovePath,
    type SemanticMemoryPage,
    type SemanticMemoryPageList,
    type SemanticMemoryPathInput,
    type SemanticMemoryPathMutationResult,
    type SemanticMemorySavePage,
    type SemanticMemorySearchInput,
    type SemanticMemorySearchResult,
    type SemanticMemoryStatus,
    semanticMemoryBacklinkListSchema,
    semanticMemoryCreatePageSchema,
    semanticMemoryMovePathSchema,
    semanticMemoryPageListSchema,
    semanticMemoryPageSchema,
    semanticMemorySavePageSchema,
    semanticMemorySearchInputSchema,
    semanticMemorySearchResultSchema,
    semanticMemoryStatusSchema,
} from '@tavern/api';
import { z } from 'zod';

const agentRuntimeClientOptionsSchema = z.object({
    baseUrl: z.string().url(),
    token: z.string().trim().min(1).optional(),
});

export class AgentRuntimeRequestError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly status: number;

    constructor(input: { code: string; message: string; retryable: boolean; status: number }) {
        super(input.message);
        this.name = 'AgentRuntimeRequestError';
        this.code = input.code;
        this.retryable = input.retryable;
        this.status = input.status;
    }
}

export interface TavernAgentRuntimeClient {
    addMcpServer(input: AgentRuntimeMcpServerCreate): Promise<AgentRuntimeMcpServer>;
    addSkillHubTap(input: AgentRuntimeSkillHubTap): Promise<AgentRuntimeSkillHubTapList>;
    applyAgentEngineConfig(
        input: AgentRuntimeApplyAgentEngineConfig
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    cancelModelProviderOAuth(input: AgentRuntimeCancelModelProviderOAuth): Promise<unknown>;
    close(): void;
    completeGoogleOAuth(
        sessionId: string,
        input: AgentRuntimeCompleteGoogleOAuth
    ): Promise<AgentRuntimeGoogleOAuthPoll>;
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    createTask(input: AgentRuntimeCreateTask): Promise<AgentRuntimeTask>;
    createSemanticMemoryFolder(
        input: SemanticMemoryPathInput
    ): Promise<SemanticMemoryPathMutationResult>;
    createSemanticMemoryPage(
        input: SemanticMemoryCreatePage
    ): Promise<SemanticMemoryPathMutationResult>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteTask(taskId: string): Promise<{ deleted: boolean; id: string }>;
    deleteDiscordBinding(
        bindingId: string,
        input: AgentRuntimeDeleteDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    deleteOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    deleteSemanticMemoryFolder(
        input: SemanticMemoryPathInput
    ): Promise<SemanticMemoryPathMutationResult>;
    deleteSemanticMemoryPage(
        input: SemanticMemoryPathInput
    ): Promise<SemanticMemoryPathMutationResult>;
    disconnectGoogleOAuth(): Promise<AgentRuntimeGoogleSettings>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentEngineConfig(): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    getAgentEnv(): Promise<AgentRuntimeAgentEnv>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getTask(taskId: string): Promise<AgentRuntimeTask>;
    getCurrentAgentSession(input: {
        agentId?: string;
        chatId: string;
    }): Promise<AgentRuntimeCurrentAgentSessionResult>;
    getGoogleSettings(): Promise<AgentRuntimeGoogleSettings>;
    getMcpCatalog(): Promise<AgentRuntimeMcpCatalog>;
    getMemoryJob(jobId: string): Promise<MemoryJobDetail | null>;
    getMemorySettings(): Promise<AgentRuntimeMemorySettings>;
    getMerchbaseSettings(): Promise<AgentRuntimeMerchbaseSettings>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModelCategorySettings(): Promise<AgentRuntimeModelCategorySettings>;
    getModelProviderCatalog(): Promise<AgentRuntimeModelProviderCatalog>;
    getModelProvidersEnabled(): Promise<AgentRuntimeModelProviderEnabled>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getPlugin(id: AgentRuntimePluginId): Promise<AgentRuntimePlugin>;
    getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail | null>;
    getSemanticMemoryPage(input: { path: string }): Promise<SemanticMemoryPage | null>;
    getSemanticMemorySettings(): Promise<AgentRuntimeSemanticMemorySettings>;
    getSemanticMemoryStatus(): Promise<SemanticMemoryStatus>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getSkill(skillId: string): Promise<AgentRuntimeSkill>;
    getSkillHubAvailable(): Promise<AgentRuntimeSkillHubAvailable>;
    getTimezoneSettings(): Promise<AgentRuntimeTimezoneSettings>;
    getToolConfig(toolId: string): Promise<AgentRuntimeToolConfig>;
    getUpdateStatus(): Promise<AgentRuntimeUpdate>;
    getWorkspaceFile(agentId: string, path: string): Promise<AgentRuntimeWorkspaceFileContent>;
    getWorkspaceInstructions(agentId: string): Promise<AgentRuntimeRenderedWorkspaceInstructions>;
    installMcpCatalogEntry(
        input: AgentRuntimeMcpCatalogInstall
    ): Promise<AgentRuntimeSkillHubActionResult>;
    installSkillHubSkill(
        input: AgentRuntimeSkillHubInstallInput
    ): Promise<AgentRuntimeSkillHubActionResult>;
    listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList>;
    listAgentPluginGrants(agentId: string): Promise<AgentRuntimeAgentPluginGrantList>;
    listAgents(): Promise<{ agents: AgentRuntimeAgent[] }>;
    listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }>;
    listCapabilities(): Promise<AgentRuntimeCapabilityHealthList>;
    listChats(): Promise<{ chats: AgentRuntimeChat[] }>;
    listCronJobs(): Promise<AgentRuntimeCronList>;
    listTasks(): Promise<AgentRuntimeTaskList>;
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listDiscordBindings(): Promise<{ bindings: AgentRuntimeDiscordBinding[] }>;
    listEvents(input?: AgentRuntimeListEventsInput): Promise<AgentRuntimeEventList>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listMcpServers(): Promise<AgentRuntimeMcpServerList>;
    listMemoryJobs(input?: AgentRuntimeListMemoryJobsInput): Promise<MemoryJobList>;
    listMemoryWorkers(): Promise<MemoryWorkerStatusList>;
    listPlugins(): Promise<AgentRuntimePluginList>;
    listRuntimeJobs(): Promise<AgentRuntimeJobList>;
    listSemanticMemoryBacklinks(input: { path: string }): Promise<SemanticMemoryBacklinkList>;
    listSemanticMemoryPages(): Promise<SemanticMemoryPageList>;
    listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ): Promise<AgentRuntimeSessionMessageList>;
    listSessionPreviews(
        input: AgentRuntimeListSessionPreviewsInput
    ): Promise<AgentRuntimeSessionPreviewList>;
    listSessions(): Promise<AgentRuntimeSessionList>;
    listSkillHubTaps(): Promise<AgentRuntimeSkillHubTapList>;
    listSkills(
        options?: AgentRuntimeListSkillsOptions
    ): Promise<{ skills: AgentRuntimeSkillSummary[] }>;
    listTools(): Promise<AgentRuntimeToolList>;
    listWorkspaceFiles(
        agentId: string,
        input?: AgentRuntimeWorkspaceFileListInput
    ): Promise<AgentRuntimeWorkspaceFileList>;
    moveSemanticMemoryPath(
        input: SemanticMemoryMovePath
    ): Promise<SemanticMemoryPathMutationResult>;
    pollGoogleOAuth(input: AgentRuntimeGoogleOAuthPollInput): Promise<AgentRuntimeGoogleOAuthPoll>;
    pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth): Promise<unknown>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    previewSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubPreview>;
    queryGoogleCalendarEvents(
        input: AgentRuntimeGoogleCalendarEventsListInput
    ): Promise<AgentRuntimeGoogleCalendarEventsList>;
    queryMerchbaseAction(
        input: AgentRuntimeMerchbaseActionInput
    ): Promise<AgentRuntimeMerchbaseActionResult>;
    queryMerchbaseSalesSeries(
        input: AgentRuntimeMerchbaseSalesSeriesInput
    ): Promise<AgentRuntimeMerchbaseSalesSeries>;
    refreshCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    removeMcpServer(name: string): Promise<{ ok: boolean }>;
    removeSkillHubTap(repo: string): Promise<AgentRuntimeSkillHubTapList>;
    resetAgentSession(
        chatId: string,
        input: AgentRuntimeResetAgentSession
    ): Promise<AgentRuntimeResetAgentSessionResult>;
    resetSkill(skillId: string): Promise<AgentRuntimeSkillResetResult>;
    restartForUpdate(): Promise<AgentRuntimeUpdate>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun>;
    runMemoryDream(agentId: string): Promise<MemoryDreamResult>;
    runRuntimeJob(
        slug: AgentRuntimeJobSlug,
        input?: AgentRuntimeRunJobInput
    ): Promise<AgentRuntimeRunJob>;
    runToolPostSetup(
        toolId: string,
        input: AgentRuntimeToolPostSetup
    ): Promise<AgentRuntimeSkillHubActionResult>;
    saveAgentEnv(input: AgentRuntimeSaveAgentEnv): Promise<AgentRuntimeSaveAgentEnvResult>;
    saveAgentFile(
        agentId: string,
        path: string,
        input: AgentRuntimeSaveAgentFile
    ): Promise<AgentRuntimeAgentFileContent>;
    saveDiscordBinding(
        input: AgentRuntimeSaveDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    saveGoogleSettings(input: AgentRuntimeSaveGoogleSettings): Promise<AgentRuntimeGoogleSettings>;
    saveMemorySettings(
        input: AgentRuntimeSaveMemorySettings
    ): Promise<AgentRuntimeSaveMemorySettingsResult>;
    saveMerchbaseSettings(
        input: AgentRuntimeSaveMerchbaseSettings
    ): Promise<AgentRuntimeMerchbaseSettings>;
    saveModelCategorySettings(
        input: AgentRuntimeSaveModelCategorySettings
    ): Promise<AgentRuntimeSaveModelCategorySettingsResult>;
    saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey): Promise<{ ok: boolean }>;
    saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings): Promise<AgentRuntimeOpenAiSettings>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveSemanticMemoryPage(
        input: SemanticMemorySavePage
    ): Promise<SemanticMemoryPathMutationResult>;
    saveSemanticMemorySettings(
        input: AgentRuntimeSaveSemanticMemorySettings
    ): Promise<AgentRuntimeSaveSemanticMemorySettingsResult>;
    saveTimezoneSettings(
        input: AgentRuntimeSaveTimezoneSettings
    ): Promise<AgentRuntimeSaveTimezoneSettingsResult>;
    saveToolEnv(
        toolId: string,
        input: AgentRuntimeToolEnvUpdate
    ): Promise<AgentRuntimeToolEnvUpdateResult>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    scanSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubScan>;
    searchSemanticMemory(input: SemanticMemorySearchInput): Promise<SemanticMemorySearchResult>;
    selectToolProvider(
        toolId: string,
        input: AgentRuntimeToolProviderSelect
    ): Promise<AgentRuntimeToolProviderSelectResult>;
    setAgentPluginGrant(
        agentId: string,
        pluginId: AgentRuntimePluginId,
        input: AgentRuntimeUpdateAgentPluginGrant
    ): Promise<AgentRuntimeAgentPluginGrant>;
    setMcpServerEnabled(name: string, enabled: boolean): Promise<{ ok: boolean }>;
    setModelProviderEnabled(
        providerId: string,
        input: AgentRuntimeUpdateModelProvider
    ): Promise<AgentRuntimeModelProviderCatalogEntry>;
    startGoogleOAuth(input?: AgentRuntimeStartGoogleOAuth): Promise<AgentRuntimeGoogleOAuthStart>;
    startModelProviderOAuth(input: AgentRuntimeStartModelProviderOAuth): Promise<unknown>;
    startUpdate(input?: { targetVersion?: null | string }): Promise<AgentRuntimeUpdate>;
    steerChatTurn(
        chatId: string,
        input: AgentRuntimeSteerTurn
    ): Promise<AgentRuntimeSteerTurnResult>;
    stopChatTurn(chatId: string, input: AgentRuntimeStopTurn): Promise<AgentRuntimeStopTurnResult>;
    submitModelProviderOAuth(input: AgentRuntimeSubmitModelProviderOAuth): Promise<unknown>;
    testMcpServer(name: string): Promise<AgentRuntimeMcpServerTestResult>;
    uninstallSkillHubSkill(
        input: AgentRuntimeSkillHubUninstallInput
    ): Promise<AgentRuntimeSkillHubActionResult>;
    updateAgentModel(
        agentId: string,
        input: AgentRuntimeUpdateAgentModel
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentName(
        agentId: string,
        input: AgentRuntimeUpdateAgentName
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentSessionModel(
        chatId: string,
        input: AgentRuntimeUpdateAgentSessionModel
    ): Promise<AgentRuntimeUpdateAgentSessionModelResult>;
    updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
    updateTask(taskId: string, input: AgentRuntimeUpdateTask): Promise<AgentRuntimeTask>;
    updateSkillEnabled(
        skillId: string,
        input: AgentRuntimeUpdateSkillEnabled
    ): Promise<AgentRuntimeSkill>;
    updateToolEnabled(
        toolId: string,
        input: AgentRuntimeUpdateToolEnabled
    ): Promise<AgentRuntimeTool>;
    upsertAgent(input: AgentRuntimeCreateAgent): Promise<AgentRuntimeAgent>;
    upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding>;
}

export interface AgentRuntimeListSessionMessagesOptions {
    limit?: number;
}

export interface AgentRuntimeListEventsInput {
    afterCursor?: string;
    limit?: number;
}

export interface AgentRuntimeListSessionPreviewsInput {
    keys: string[];
    limit?: number;
    maxChars?: number;
}

export interface AgentRuntimeListSkillsOptions {
    agentId?: string;
}

export interface AgentRuntimeListMemoryJobsInput {
    agentId?: string;
    kind?: MemoryJobKind[];
    limit?: number;
    sinceDays?: number;
    status?: MemoryJobStatus[];
}

interface AgentRuntimeClientOptions {
    baseUrl: string;
    token?: string;
}

function trimTrailingSlash(value: string) {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function readErrorResponse(response: Response) {
    const payload = await response.json().catch(() => null);
    const parsed = agentRuntimeErrorSchema.safeParse(payload);

    if (parsed.success) {
        throw new AgentRuntimeRequestError({
            code: parsed.data.code,
            message: parsed.data.message,
            retryable: parsed.data.retryable,
            status: response.status,
        });
    }

    throw new AgentRuntimeRequestError({
        code: 'control_plane_request_failed',
        message: `Runtime request failed with status ${response.status}.`,
        retryable: response.status >= 500,
        status: response.status,
    });
}

class HttpTavernAgentRuntimeClient implements TavernAgentRuntimeClient {
    readonly #baseUrl: string;
    readonly #authHeaders: Record<string, string>;

    constructor(options: AgentRuntimeClientOptions) {
        const parsed = agentRuntimeClientOptionsSchema.parse(options);
        this.#baseUrl = trimTrailingSlash(parsed.baseUrl);
        this.#authHeaders = parsed.token ? { authorization: `Bearer ${parsed.token}` } : {};
    }

    close() {}

    async postSemanticMemoryQuery<T>(
        route: string,
        input: unknown,
        schema: z.ZodType<T>
    ): Promise<T> {
        const response = await fetch(`${this.#baseUrl}${route}`, {
            body: JSON.stringify(input),
            headers: { ...this.#authHeaders, 'content-type': 'application/json' },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return schema.parse(await response.json());
    }

    async upsertAgent(input: AgentRuntimeCreateAgent) {
        const payload = agentRuntimeCreateAgentSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agents}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async getAgentConfig(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentConfig(agentId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async listAgentFiles(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentFiles(agentId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileListSchema.parse(await response.json());
    }

    async getAgentFile(agentId: string, path: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentFile(agentId, path)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileContentSchema.parse(await response.json());
    }

    async listWorkspaceFiles(
        agentId: string,
        input: AgentRuntimeWorkspaceFileListInput = { path: '' }
    ) {
        const payload = agentRuntimeWorkspaceFileListInputSchema.parse(input);
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentFiles(agentId)}`);
        if (payload.path) {
            url.searchParams.set('path', payload.path);
        }

        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceFileListSchema.parse(await response.json());
    }

    async getWorkspaceFile(agentId: string, path: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentFile(agentId, path)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceFileContentSchema.parse(await response.json());
    }

    async saveAgentFile(agentId: string, path: string, input: AgentRuntimeSaveAgentFile) {
        const payload = agentRuntimeSaveAgentFileSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentFile(agentId, path)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileContentSchema.parse(await response.json());
    }

    async saveWorkspaceInstructions(agentId: string, input: AgentRuntimeSaveWorkspaceInstructions) {
        const payload = agentRuntimeSaveWorkspaceInstructionsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentInstructions(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWorkspaceInstructionsSchema.parse(await response.json());
    }

    async getWorkspaceInstructions(agentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.workspaceAgentInstructions(agentId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeRenderedWorkspaceInstructionsSchema.parse(await response.json());
    }

    async listAgents() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agents}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentListSchema.parse(await response.json());
    }

    async listEvents(input: AgentRuntimeListEventsInput = {}) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.events}`);
        if (input.afterCursor) {
            url.searchParams.set('after_cursor', input.afterCursor);
        }
        if (input.limit !== undefined) {
            url.searchParams.set('limit', String(input.limit));
        }
        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return runtimeEventListSchema.parse(await response.json());
    }

    async deleteAgent(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agent(agentId)}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveAgentSchema.parse(await response.json());
    }

    async createCronJob(input: AgentRuntimeCreateCron) {
        const payload = agentRuntimeCreateCronSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJobs}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronSchema.parse(await response.json());
    }

    async getCronJob(jobId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJob(jobId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronSchema.parse(await response.json());
    }

    async listCronJobs() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJobs}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronListSchema.parse(await response.json());
    }

    async listCronRuns(jobId?: string) {
        const route = jobId ? agentRuntimeRoutes.cronJobRuns(jobId) : agentRuntimeRoutes.cronRuns;
        const response = await fetch(`${this.#baseUrl}${route}`, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronRunListSchema.parse(await response.json());
    }

    async updateCronJob(jobId: string, input: AgentRuntimeUpdateCron) {
        const payload = agentRuntimeUpdateCronSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJob(jobId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronSchema.parse(await response.json());
    }

    async deleteCronJob(jobId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJob(jobId)}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveCronSchema.parse(await response.json());
    }

    async createTask(input: AgentRuntimeCreateTask) {
        const payload = agentRuntimeCreateTaskSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.tasks}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTaskSchema.parse(await response.json());
    }

    async getTask(taskId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.task(taskId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTaskSchema.parse(await response.json());
    }

    async listTasks() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.tasks}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTaskListSchema.parse(await response.json());
    }

    async updateTask(taskId: string, input: AgentRuntimeUpdateTask) {
        const payload = agentRuntimeUpdateTaskSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.task(taskId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTaskSchema.parse(await response.json());
    }

    async deleteTask(taskId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.task(taskId)}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return (await response.json()) as { deleted: boolean; id: string };
    }

    async runCronJob(jobId: string, input?: AgentRuntimeRunCron) {
        const payload = agentRuntimeRunCronSchema.parse(input ?? {});
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJobRun(jobId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronRunSchema.parse(await response.json());
    }

    async listRuntimeJobs() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.jobs}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeJobListSchema.parse(await response.json());
    }

    async listMemoryJobs(input: AgentRuntimeListMemoryJobsInput = {}) {
        const params = new URLSearchParams();
        if (input.agentId) {
            params.set('agentId', input.agentId);
        }
        if (input.kind && input.kind.length > 0) {
            params.set('kind', input.kind.join(','));
        }
        if (input.limit) {
            params.set('limit', String(input.limit));
        }
        if (input.sinceDays) {
            params.set('sinceDays', String(input.sinceDays));
        }
        if (input.status && input.status.length > 0) {
            params.set('status', input.status.join(','));
        }
        const suffix = params.size > 0 ? `?${params.toString()}` : '';
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memoryJobs}${suffix}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryJobListSchema.parse(await response.json());
    }

    async listMemoryWorkers() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memoryWorkers}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryWorkerStatusListSchema.parse(await response.json());
    }

    async listCapabilities() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.capabilities}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return parseAgentRuntimeCapabilityHealthList(await response.json());
    }

    async resetAgentSession(chatId: string, input: AgentRuntimeResetAgentSession) {
        const payload = agentRuntimeResetAgentSessionSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatAgentSessionReset(chatId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeResetAgentSessionResultSchema.parse(await response.json());
    }

    async getCapability(id: AgentRuntimeCapabilityHealthId) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.capability(
                agentRuntimeCapabilityHealthIdSchema.parse(id)
            )}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCapabilityHealthSchema.parse(await response.json());
    }

    async refreshCapability(id: AgentRuntimeCapabilityHealthId) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.capabilityRefresh(
                agentRuntimeCapabilityHealthIdSchema.parse(id)
            )}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCapabilityHealthSchema.parse(await response.json());
    }

    async getUpdateStatus(): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.updateStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async restartForUpdate(): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.updateRestart}`, {
            headers: {
                ...this.#authHeaders,
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async startUpdate(input?: { targetVersion?: null | string }): Promise<AgentRuntimeUpdate> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.update}`, {
            body: JSON.stringify(input ?? {}),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateSchema.parse(await response.json());
    }

    async getRuntimeJob(slug: AgentRuntimeJobSlug) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.job(agentRuntimeJobSlugSchema.parse(slug))}`,
            { headers: this.#authHeaders }
        );

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeJobDetailSchema.parse(await response.json());
    }

    async runRuntimeJob(slug: AgentRuntimeJobSlug, input?: AgentRuntimeRunJobInput) {
        const body = input ? agentRuntimeRunJobInputSchema.parse(input) : null;
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.jobRun(agentRuntimeJobSlugSchema.parse(slug))}`,
            {
                body: body ? JSON.stringify(body) : undefined,
                headers: {
                    ...this.#authHeaders,
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeRunJobSchema.parse(await response.json());
    }

    async getSemanticMemoryStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return semanticMemoryStatusSchema.parse(await response.json());
    }

    async getSemanticMemorySettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemorySettings}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSemanticMemorySettingsSchema.parse(await response.json());
    }

    async saveSemanticMemorySettings(input: AgentRuntimeSaveSemanticMemorySettings) {
        const payload = agentRuntimeSaveSemanticMemorySettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemorySettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveSemanticMemorySettingsResultSchema.parse(await response.json());
    }

    async createSemanticMemoryPage(input: SemanticMemoryCreatePage) {
        const payload = semanticMemoryCreatePageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryPages}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async saveSemanticMemoryPage(input: SemanticMemorySavePage) {
        const payload = semanticMemorySavePageSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryPage(payload.path)}`,
            {
                body: JSON.stringify({ body: payload.body }),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async createSemanticMemoryFolder(input: SemanticMemoryPathInput) {
        const payload = memoryPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryFolders}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async listSemanticMemoryPages() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryPages}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return semanticMemoryPageListSchema.parse(await response.json());
    }

    async getSemanticMemoryPage(input: { path: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryPage(input.path)}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return semanticMemoryPageSchema.parse(await response.json());
    }

    async deleteSemanticMemoryPage(input: SemanticMemoryPathInput) {
        const payload = memoryPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryPage(payload.path)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async deleteSemanticMemoryFolder(input: SemanticMemoryPathInput) {
        const payload = memoryPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryFolder(payload.path)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async moveSemanticMemoryPath(input: SemanticMemoryMovePath) {
        const payload = semanticMemoryMovePathSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryMovePath}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryPathMutationResultSchema.parse(await response.json());
    }

    async searchSemanticMemory(input: SemanticMemorySearchInput) {
        return await this.postSemanticMemoryQuery(
            agentRuntimeRoutes.semanticMemorySearch,
            semanticMemorySearchInputSchema.parse(input),
            semanticMemorySearchResultSchema
        );
    }

    async listSemanticMemoryBacklinks(input: { path: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.semanticMemoryBacklinks(input.path)}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return semanticMemoryBacklinkListSchema.parse(await response.json());
    }

    async getModels() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.models}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelsSchema.parse(await response.json());
    }

    async getAgentEngineConfig() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEngineConfig}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async applyAgentEngineConfig(input: AgentRuntimeApplyAgentEngineConfig) {
        const payload = agentRuntimeApplyAgentEngineConfigSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEngineConfig}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentName(agentId: string, input: AgentRuntimeUpdateAgentName) {
        const payload = agentRuntimeUpdateAgentNameSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentName(agentId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentModel(agentId: string, input: AgentRuntimeUpdateAgentModel) {
        const payload = agentRuntimeUpdateAgentModelSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentModel(agentId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PATCH',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ) {
        const payload = agentRuntimeUpdateAgentThinkingDefaultSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentThinkingDefault(agentId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PATCH',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async getModelAccess() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccess}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessSchema.parse(await response.json());
    }

    async getModelProviderCatalog() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvidersCatalog}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderCatalogSchema.parse(await response.json());
    }

    async getModelProvidersEnabled() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvidersEnabled}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderEnabledSchema.parse(await response.json());
    }

    async setModelProviderEnabled(providerId: string, input: AgentRuntimeUpdateModelProvider) {
        const payload = agentRuntimeUpdateModelProviderSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelProvider(providerId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: payload.enabled ? 'PUT' : 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderCatalogEntrySchema.parse(await response.json());
    }

    async saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey) {
        const payload = agentRuntimeSaveModelProviderApiKeySchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccessApiKey}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return { ok: true };
    }

    async startModelProviderOAuth(input: AgentRuntimeStartModelProviderOAuth) {
        const payload = agentRuntimeStartModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthStart(payload.providerId)}`,
            {
                body: JSON.stringify({}),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthStartSchema.parse(await response.json());
    }

    async pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth) {
        const payload = agentRuntimePollModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthPoll(payload.providerId, payload.sessionId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthPollSchema.parse(await response.json());
    }

    async submitModelProviderOAuth(input: AgentRuntimeSubmitModelProviderOAuth) {
        const payload = agentRuntimeSubmitModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthSubmit(payload.providerId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthSubmitSchema.parse(await response.json());
    }

    async cancelModelProviderOAuth(input: AgentRuntimeCancelModelProviderOAuth) {
        const payload = agentRuntimeCancelModelProviderOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOAuthCancel(payload.sessionId)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelProviderOAuthCancelSchema.parse(await response.json());
    }

    async getOpenRouterSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async getOpenAiSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings) {
        const payload = agentRuntimeSaveOpenAiSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async deleteOpenAiSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenAiSettings}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenAiSettingsSchema.parse(await response.json());
    }

    async saveOpenRouterSettings(input: AgentRuntimeSaveOpenRouterSettings) {
        const payload = agentRuntimeSaveOpenRouterSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async deleteOpenRouterSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async getTimezoneSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.timezoneSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTimezoneSettingsSchema.parse(await response.json());
    }

    async saveTimezoneSettings(input: AgentRuntimeSaveTimezoneSettings) {
        const payload = agentRuntimeSaveTimezoneSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.timezoneSettings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveTimezoneSettingsResultSchema.parse(await response.json());
    }

    async getMemorySettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memorySettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMemorySettingsSchema.parse(await response.json());
    }

    async getMemoryJob(jobId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memoryJob(jobId)}`, {
            headers: this.#authHeaders,
        });

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryJobDetailSchema.parse(await response.json());
    }

    async runMemoryDream(agentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.memoryAgentDream(agentId)}`,
            {
                body: JSON.stringify({ agentId }),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryDreamResultSchema.parse(await response.json());
    }

    async saveMemorySettings(input: AgentRuntimeSaveMemorySettings) {
        const payload = agentRuntimeSaveMemorySettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memorySettings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveMemorySettingsResultSchema.parse(await response.json());
    }

    async getModelCategorySettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCategorySettings}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelCategorySettingsSchema.parse(await response.json());
    }

    async saveModelCategorySettings(input: AgentRuntimeSaveModelCategorySettings) {
        const payload = agentRuntimeSaveModelCategorySettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCategorySettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveModelCategorySettingsResultSchema.parse(await response.json());
    }

    async getAgentEnv(): Promise<AgentRuntimeAgentEnv> {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEnv}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEnvSchema.parse(await response.json());
    }

    async saveAgentEnv(input: AgentRuntimeSaveAgentEnv): Promise<AgentRuntimeSaveAgentEnvResult> {
        const payload = agentRuntimeSaveAgentEnvSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentEnv}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSaveAgentEnvResultSchema.parse(await response.json());
    }

    async listPlugins() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.plugins}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimePluginListSchema.parse(await response.json());
    }

    async listAgentPluginGrants(agentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentPluginGrants(agentId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentPluginGrantListSchema.parse(await response.json());
    }

    async setAgentPluginGrant(
        agentId: string,
        pluginId: AgentRuntimePluginId,
        input: AgentRuntimeUpdateAgentPluginGrant
    ) {
        const payload = agentRuntimeUpdateAgentPluginGrantSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentPluginGrant(agentId, pluginId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentPluginGrantSchema.parse(await response.json());
    }

    async getPlugin(id: AgentRuntimePluginId) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.plugin(agentRuntimePluginIdSchema.parse(id))}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimePluginSchema.parse(await response.json());
    }

    async getMerchbaseSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginMerchbaseSettings}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMerchbaseSettingsSchema.parse(await response.json());
    }

    async getGoogleSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleSettingsSchema.parse(await response.json());
    }

    async saveMerchbaseSettings(input: AgentRuntimeSaveMerchbaseSettings) {
        const payload = agentRuntimeSaveMerchbaseSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginMerchbaseSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMerchbaseSettingsSchema.parse(await response.json());
    }

    async saveGoogleSettings(input: AgentRuntimeSaveGoogleSettings) {
        const payload = agentRuntimeSaveGoogleSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleSettings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleSettingsSchema.parse(await response.json());
    }

    async startGoogleOAuth(input: AgentRuntimeStartGoogleOAuth = {}) {
        const payload = agentRuntimeStartGoogleOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleOAuthStart}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleOAuthStartSchema.parse(await response.json());
    }

    async completeGoogleOAuth(sessionId: string, input: AgentRuntimeCompleteGoogleOAuth) {
        const payload = agentRuntimeCompleteGoogleOAuthSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleOAuthComplete(sessionId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleOAuthPollSchema.parse(await response.json());
    }

    async pollGoogleOAuth(input: AgentRuntimeGoogleOAuthPollInput) {
        const payload = agentRuntimeGoogleOAuthPollInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleOAuthPoll(payload.sessionId)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleOAuthPollSchema.parse(await response.json());
    }

    async disconnectGoogleOAuth() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleDisconnect}`,
            {
                body: JSON.stringify({}),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleSettingsSchema.parse(await response.json());
    }

    async queryMerchbaseSalesSeries(input: AgentRuntimeMerchbaseSalesSeriesInput) {
        const payload = agentRuntimeMerchbaseSalesSeriesInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginMerchbaseSalesSeries}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMerchbaseSalesSeriesSchema.parse(await response.json());
    }

    async queryGoogleCalendarEvents(input: AgentRuntimeGoogleCalendarEventsListInput) {
        const payload = agentRuntimeGoogleCalendarEventsListInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginGoogleCalendarEvents}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeGoogleCalendarEventsListSchema.parse(await response.json());
    }

    async queryMerchbaseAction(input: AgentRuntimeMerchbaseActionInput) {
        const payload = agentRuntimeMerchbaseActionInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginMerchbaseAction}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMerchbaseActionResultSchema.parse(await response.json());
    }

    async listSkills(options?: AgentRuntimeListSkillsOptions) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.skills}`);
        if (options?.agentId) {
            url.searchParams.set('agentId', options.agentId);
        }
        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillListSchema.parse(await response.json());
    }

    async getSkill(skillId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.skill(skillId)}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async listTools() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.tools}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeToolListSchema.parse(await response.json());
    }

    async updateSkillEnabled(skillId: string, input: AgentRuntimeUpdateSkillEnabled) {
        const payload = agentRuntimeUpdateSkillEnabledSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.skillEnabled(skillId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async updateToolEnabled(toolId: string, input: AgentRuntimeUpdateToolEnabled) {
        const payload = agentRuntimeUpdateToolEnabledSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.toolEnabled(toolId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'PUT',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeToolSchema.parse(await response.json());
    }

    async getSkillHubAvailable() {
        return agentRuntimeSkillHubAvailableSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.skillHubAvailable)
        );
    }

    async previewSkillHubSkill(identifier: string) {
        const params = new URLSearchParams({ identifier });
        return agentRuntimeSkillHubPreviewSchema.parse(
            await this.#getSkillHubJson(
                `${agentRuntimeRoutes.skillHubPreview}?${params.toString()}`
            )
        );
    }

    async scanSkillHubSkill(identifier: string) {
        const params = new URLSearchParams({ identifier });
        return agentRuntimeSkillHubScanSchema.parse(
            await this.#getSkillHubJson(`${agentRuntimeRoutes.skillHubScan}?${params.toString()}`)
        );
    }

    async installSkillHubSkill(input: AgentRuntimeSkillHubInstallInput) {
        const payload = agentRuntimeSkillHubInstallInputSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubInstall, payload)
        );
    }

    async uninstallSkillHubSkill(input: AgentRuntimeSkillHubUninstallInput) {
        const payload = agentRuntimeSkillHubUninstallInputSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubUninstall, payload)
        );
    }

    async resetSkill(skillId: string) {
        return agentRuntimeSkillResetResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillReset(skillId), undefined)
        );
    }

    async listSkillHubTaps() {
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.skillHubTaps)
        );
    }

    async addSkillHubTap(input: AgentRuntimeSkillHubTap) {
        const payload = agentRuntimeSkillHubTapSchema.parse(input);
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.skillHubTaps, payload)
        );
    }

    async removeSkillHubTap(repo: string) {
        return agentRuntimeSkillHubTapListSchema.parse(
            await this.#sendSkillHubJson('DELETE', agentRuntimeRoutes.skillHubTap(repo), undefined)
        );
    }

    async getToolConfig(toolId: string) {
        return agentRuntimeToolConfigSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.toolConfig(toolId))
        );
    }

    async listMcpServers() {
        return agentRuntimeMcpServerListSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpServers)
        );
    }

    async addMcpServer(input: AgentRuntimeMcpServerCreate) {
        const payload = agentRuntimeMcpServerCreateSchema.parse(input);
        return agentRuntimeMcpServerSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.mcpServers, payload)
        );
    }

    async removeMcpServer(name: string) {
        return (await this.#sendSkillHubJson(
            'DELETE',
            agentRuntimeRoutes.mcpServer(name),
            undefined
        )) as { ok: boolean };
    }

    async testMcpServer(name: string) {
        return agentRuntimeMcpServerTestResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.mcpServerTest(name), {})
        );
    }

    async setMcpServerEnabled(name: string, enabled: boolean) {
        return (await this.#sendSkillHubJson('PUT', agentRuntimeRoutes.mcpServerEnabled(name), {
            enabled,
        })) as { ok: boolean };
    }

    async getMcpCatalog() {
        return agentRuntimeMcpCatalogSchema.parse(
            await this.#getSkillHubJson(agentRuntimeRoutes.mcpCatalog)
        );
    }

    async installMcpCatalogEntry(input: AgentRuntimeMcpCatalogInstall) {
        const payload = agentRuntimeMcpCatalogInstallSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.mcpCatalogInstall, payload)
        );
    }

    async selectToolProvider(toolId: string, input: AgentRuntimeToolProviderSelect) {
        const payload = agentRuntimeToolProviderSelectSchema.parse(input);
        return agentRuntimeToolProviderSelectResultSchema.parse(
            await this.#sendSkillHubJson('PUT', agentRuntimeRoutes.toolProvider(toolId), payload)
        );
    }

    async saveToolEnv(toolId: string, input: AgentRuntimeToolEnvUpdate) {
        const payload = agentRuntimeToolEnvUpdateSchema.parse(input);
        return agentRuntimeToolEnvUpdateResultSchema.parse(
            await this.#sendSkillHubJson('PUT', agentRuntimeRoutes.toolEnv(toolId), payload)
        );
    }

    async runToolPostSetup(toolId: string, input: AgentRuntimeToolPostSetup) {
        const payload = agentRuntimeToolPostSetupSchema.parse(input);
        return agentRuntimeSkillHubActionResultSchema.parse(
            await this.#sendSkillHubJson('POST', agentRuntimeRoutes.toolPostSetup(toolId), payload)
        );
    }

    async #getSkillHubJson(pathname: string) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return await response.json();
    }

    async #sendSkillHubJson(method: 'DELETE' | 'POST' | 'PUT', pathname: string, payload: unknown) {
        const response = await fetch(`${this.#baseUrl}${pathname}`, {
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return await response.json();
    }

    async listMacApps(options?: { limit?: number; query?: string }) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.macApps}`);

        if (options?.query) {
            url.searchParams.set('query', options.query);
        }

        if (options?.limit !== undefined) {
            url.searchParams.set('limit', String(options.limit));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMacAppListSchema.parse(await response.json());
    }

    async postMessage(chatId: string, input: AgentRuntimeCreateMessage) {
        const payload = agentRuntimeCreateMessageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chatMessages(chatId)}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMessageAcceptedSchema.parse(await response.json());
    }

    async getCurrentAgentSession(input: { agentId?: string; chatId: string }) {
        const url = new URL(
            `${this.#baseUrl}${agentRuntimeRoutes.chatAgentSessionCurrent(input.chatId)}`
        );

        if (input.agentId) {
            url.searchParams.set('agentId', input.agentId);
        }

        const response = await fetch(url, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCurrentAgentSessionResultSchema.parse(await response.json());
    }

    async updateAgentSessionModel(chatId: string, input: AgentRuntimeUpdateAgentSessionModel) {
        const payload = agentRuntimeUpdateAgentSessionModelSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatAgentSessionModel(chatId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PATCH',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeUpdateAgentSessionModelResultSchema.parse(await response.json());
    }

    async stopChatTurn(
        chatId: string,
        input: AgentRuntimeStopTurn
    ): Promise<AgentRuntimeStopTurnResult> {
        const payload = agentRuntimeStopTurnSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatTurnStop(chatId, payload.runId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeStopTurnResultSchema.parse(await response.json());
    }

    async steerChatTurn(
        chatId: string,
        input: AgentRuntimeSteerTurn
    ): Promise<AgentRuntimeSteerTurnResult> {
        const payload = agentRuntimeSteerTurnSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.chatTurnSteer(chatId, payload.runId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSteerTurnResultSchema.parse(await response.json());
    }

    async listChats() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chats}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeChatListSchema.parse(await response.json());
    }

    async upsertBinding(input: AgentRuntimeUpsertBinding) {
        const payload = agentRuntimeUpsertBindingSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.bindings}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingSchema.parse(await response.json());
    }

    async saveDiscordBinding(input: AgentRuntimeSaveDiscordBinding) {
        const payload = agentRuntimeSaveDiscordBindingSchema.parse(input);
        const url = payload.bindingId
            ? agentRuntimeRoutes.discordBinding(payload.bindingId)
            : agentRuntimeRoutes.discordBindings;
        const response = await fetch(`${this.#baseUrl}${url}`, {
            body: JSON.stringify(payload),
            headers: {
                ...this.#authHeaders,
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: payload.bindingId ? 'PUT' : 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async listBindings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.bindings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingListSchema.parse(await response.json());
    }

    async listDiscordBindings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.discordBindings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeDiscordBindingListSchema.parse(await response.json());
    }

    async deleteBinding(bindingId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.binding(bindingId)}`, {
            headers: this.#authHeaders,
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveBindingSchema.parse(await response.json());
    }

    async deleteDiscordBinding(bindingId: string, input: AgentRuntimeDeleteDiscordBinding) {
        const payload = agentRuntimeDeleteDiscordBindingSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.discordBinding(bindingId)}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    ...this.#authHeaders,
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'DELETE',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentEngineConfigSnapshotSchema.parse(await response.json());
    }

    async listSessions() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.sessions}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionListSchema.parse(await response.json());
    }

    async listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.sessionMessages(sessionKey)}`);

        if (options?.limit !== undefined) {
            url.searchParams.set('limit', String(options.limit));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionMessageListSchema.parse(await response.json());
    }

    async listSessionPreviews(input: AgentRuntimeListSessionPreviewsInput) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.sessionPreviews}`);

        for (const key of input.keys) {
            url.searchParams.append('key', key);
        }
        if (input.limit !== undefined) {
            url.searchParams.set('limit', String(input.limit));
        }
        if (input.maxChars !== undefined) {
            url.searchParams.set('maxChars', String(input.maxChars));
        }

        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionPreviewListSchema.parse(await response.json());
    }

    async getSessionGraph(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionGraph(sessionKey)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionGraphSchema.parse(await response.json());
    }

    async getSessionPrompt(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionPrompt(sessionKey)}`,
            { headers: this.#authHeaders }
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionPromptSchema.parse(await response.json());
    }

    async resyncSession(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionResync(sessionKey)}`,
            {
                headers: {
                    ...this.#authHeaders,
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'POST',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionResyncSchema.parse(await response.json());
    }
}

export function createAgentRuntimeClient(
    baseUrl: string,
    options?: { token?: string }
): TavernAgentRuntimeClient {
    return new HttpTavernAgentRuntimeClient({
        baseUrl,
        token: options?.token,
    });
}

function parseAgentRuntimeCapabilityHealthList(input: unknown): AgentRuntimeCapabilityHealthList {
    return agentRuntimeCapabilityHealthListSchema.parse(input);
}
