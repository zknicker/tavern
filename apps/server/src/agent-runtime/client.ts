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
    type AgentRuntimeAutoDispatchSettings,
    type AgentRuntimeBinding,
    type AgentRuntimeBrowserActionResult,
    type AgentRuntimeBrowserSettings,
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
    type AgentRuntimeCreateTaskLabel,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeCronRun,
    type AgentRuntimeCurrentAgentSessionResult,
    type AgentRuntimeDeleteDiscordBinding,
    type AgentRuntimeDiscordBinding,
    type AgentRuntimeDispatchTaskResult,
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
    type AgentRuntimeModelCapabilitySelectionSettings,
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
    type AgentRuntimeSaveAutoDispatchSettings,
    type AgentRuntimeSaveBrowserSettings,
    type AgentRuntimeSaveDiscordBinding,
    type AgentRuntimeSaveGoogleSettings,
    type AgentRuntimeSaveMemorySettings,
    type AgentRuntimeSaveMemorySettingsResult,
    type AgentRuntimeSaveMerchbaseSettings,
    type AgentRuntimeSaveModelCapabilitySelections,
    type AgentRuntimeSaveModelCategorySettings,
    type AgentRuntimeSaveModelCategorySettingsResult,
    type AgentRuntimeSaveModelProviderApiKey,
    type AgentRuntimeSaveOpenAiSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveTimezoneSettings,
    type AgentRuntimeSaveTimezoneSettingsResult,
    type AgentRuntimeSaveWikiSettings,
    type AgentRuntimeSaveWikiSettingsResult,
    type AgentRuntimeSaveWorkspaceInstructions,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionList,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPreviewList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSetTaskWorkChat,
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
    type AgentRuntimeTask,
    type AgentRuntimeTaskAttachmentContent,
    type AgentRuntimeTaskLabel,
    type AgentRuntimeTaskLabelList,
    type AgentRuntimeTaskList,
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
    type AgentRuntimeUpdateAgentBio,
    type AgentRuntimeUpdateAgentModel,
    type AgentRuntimeUpdateAgentName,
    type AgentRuntimeUpdateAgentPluginGrant,
    type AgentRuntimeUpdateAgentTaskSettings,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeUpdateAgentWebSettings,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpdateModelProvider,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateTask,
    type AgentRuntimeUpdateTaskLabel,
    type AgentRuntimeUpdateToolEnabled,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeWikiSettings,
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
    agentRuntimeAutoDispatchSettingsSchema,
    agentRuntimeBindingListSchema,
    agentRuntimeBindingSchema,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeCancelModelProviderOAuthSchema,
    agentRuntimeCapabilityHealthIdSchema,
    agentRuntimeCapabilityHealthListSchema,
    agentRuntimeCapabilityHealthSchema,
    agentRuntimeChatListSchema,
    agentRuntimeCompleteGoogleOAuthSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCreateTaskLabelSchema,
    agentRuntimeCreateTaskSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeDeleteDiscordBindingSchema,
    agentRuntimeDiscordBindingListSchema,
    agentRuntimeDispatchTaskResultSchema,
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
    agentRuntimeModelCapabilitySelectionSettingsSchema,
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
    agentRuntimeSaveAutoDispatchSettingsSchema,
    agentRuntimeSaveBrowserSettingsSchema,
    agentRuntimeSaveDiscordBindingSchema,
    agentRuntimeSaveGoogleSettingsSchema,
    agentRuntimeSaveMemorySettingsResultSchema,
    agentRuntimeSaveMemorySettingsSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
    agentRuntimeSaveModelCapabilitySelectionsSchema,
    agentRuntimeSaveModelCategorySettingsResultSchema,
    agentRuntimeSaveModelCategorySettingsSchema,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSaveOpenAiSettingsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveTimezoneSettingsResultSchema,
    agentRuntimeSaveTimezoneSettingsSchema,
    agentRuntimeSaveWikiSettingsResultSchema,
    agentRuntimeSaveWikiSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPreviewListSchema,
    agentRuntimeSessionPromptSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSetTaskWorkChatSchema,
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
    agentRuntimeTaskAttachmentContentSchema,
    agentRuntimeTaskLabelListSchema,
    agentRuntimeTaskLabelSchema,
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
    agentRuntimeUpdateAgentBioSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentPluginGrantSchema,
    agentRuntimeUpdateAgentTaskSettingsSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentWebSettingsSchema,
    agentRuntimeUpdateCronSchema,
    agentRuntimeUpdateModelProviderSchema,
    agentRuntimeUpdateSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateTaskLabelSchema,
    agentRuntimeUpdateTaskSchema,
    agentRuntimeUpdateToolEnabledSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeWikiSettingsSchema,
    agentRuntimeWorkspaceFileContentSchema,
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFileListSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    type MemoryActivityList,
    type MemoryDreamResult,
    type MemoryJobDetail,
    type MemoryJobKind,
    type MemoryJobList,
    type MemoryJobStatus,
    memoryActivityListSchema,
    memoryDreamResultSchema,
    memoryJobDetailSchema,
    memoryJobListSchema,
    runtimeEventListSchema,
    type WikiBacklinkList,
    type WikiCreatePage,
    type WikiMovePath,
    type WikiPage,
    type WikiPageList,
    type WikiPathInput,
    type WikiPathMutationResult,
    type WikiSavePage,
    type WikiSearchInput,
    type WikiSearchResult,
    type WikiStatus,
    wikiBacklinkListSchema,
    wikiCreatePageSchema,
    wikiMovePathSchema,
    wikiPageListSchema,
    wikiPageSchema,
    wikiPathInputSchema,
    wikiPathMutationResultSchema,
    wikiSavePageSchema,
    wikiSearchInputSchema,
    wikiSearchResultSchema,
    wikiStatusSchema,
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
    createTaskLabel(input: AgentRuntimeCreateTaskLabel): Promise<AgentRuntimeTaskLabel>;
    createWikiFolder(input: WikiPathInput): Promise<WikiPathMutationResult>;
    createWikiPage(input: WikiCreatePage): Promise<WikiPathMutationResult>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteDiscordBinding(
        bindingId: string,
        input: AgentRuntimeDeleteDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    deleteOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    deleteTask(taskId: string): Promise<{ deleted: boolean; id: string }>;
    deleteTaskAttachment(
        taskId: string,
        attachmentId: string
    ): Promise<{ deleted: boolean; id: string }>;
    deleteTaskLabel(labelId: string): Promise<{ deleted: boolean; id: string }>;
    deleteWikiFolder(input: WikiPathInput): Promise<WikiPathMutationResult>;
    deleteWikiPage(input: WikiPathInput): Promise<WikiPathMutationResult>;
    disconnectGoogleOAuth(): Promise<AgentRuntimeGoogleSettings>;
    dispatchTask(taskId: string, agentId: string): Promise<AgentRuntimeDispatchTaskResult>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentEngineConfig(): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    getAgentEnv(): Promise<AgentRuntimeAgentEnv>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getAutoDispatchSettings(): Promise<AgentRuntimeAutoDispatchSettings>;
    getBrowserSettings(): Promise<AgentRuntimeBrowserSettings>;
    getCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getCurrentAgentSession(input: {
        agentId?: string;
        chatId: string;
    }): Promise<AgentRuntimeCurrentAgentSessionResult>;
    getGoogleSettings(): Promise<AgentRuntimeGoogleSettings>;
    getMcpCatalog(): Promise<AgentRuntimeMcpCatalog>;
    getMemoryActivity(): Promise<MemoryActivityList>;
    getMemoryJob(jobId: string): Promise<MemoryJobDetail | null>;
    getMemorySettings(): Promise<AgentRuntimeMemorySettings>;
    getMerchbaseSettings(): Promise<AgentRuntimeMerchbaseSettings>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModelCapabilitySelections(): Promise<AgentRuntimeModelCapabilitySelectionSettings>;
    getModelCategorySettings(): Promise<AgentRuntimeModelCategorySettings>;
    getModelProviderCatalog(): Promise<AgentRuntimeModelProviderCatalog>;
    getModelProvidersEnabled(): Promise<AgentRuntimeModelProviderEnabled>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getPlugin(id: AgentRuntimePluginId): Promise<AgentRuntimePlugin>;
    getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail | null>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getSkill(skillId: string): Promise<AgentRuntimeSkill>;
    getSkillHubAvailable(): Promise<AgentRuntimeSkillHubAvailable>;
    getTask(taskId: string): Promise<AgentRuntimeTask>;
    getTaskAttachment(
        taskId: string,
        attachmentId: string
    ): Promise<AgentRuntimeTaskAttachmentContent>;
    getTimezoneSettings(): Promise<AgentRuntimeTimezoneSettings>;
    getToolConfig(toolId: string): Promise<AgentRuntimeToolConfig>;
    getUpdateStatus(): Promise<AgentRuntimeUpdate>;
    getWikiPage(input: { path: string }): Promise<WikiPage | null>;
    getWikiSettings(): Promise<AgentRuntimeWikiSettings>;
    getWikiStatus(): Promise<WikiStatus>;
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
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listDiscordBindings(): Promise<{ bindings: AgentRuntimeDiscordBinding[] }>;
    listEvents(input?: AgentRuntimeListEventsInput): Promise<AgentRuntimeEventList>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listMcpServers(): Promise<AgentRuntimeMcpServerList>;
    listMemoryJobs(input?: AgentRuntimeListMemoryJobsInput): Promise<MemoryJobList>;
    listPlugins(): Promise<AgentRuntimePluginList>;
    listRuntimeJobs(): Promise<AgentRuntimeJobList>;
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
    listTaskLabels(): Promise<AgentRuntimeTaskLabelList>;
    listTasks(): Promise<AgentRuntimeTaskList>;
    listTools(): Promise<AgentRuntimeToolList>;
    listWikiBacklinks(input: { path: string }): Promise<WikiBacklinkList>;
    listWikiPages(): Promise<WikiPageList>;
    listWorkspaceFiles(
        agentId: string,
        input?: AgentRuntimeWorkspaceFileListInput
    ): Promise<AgentRuntimeWorkspaceFileList>;
    moveWikiPath(input: WikiMovePath): Promise<WikiPathMutationResult>;
    openBrowser(): Promise<AgentRuntimeBrowserActionResult>;
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
    restartBrowser(): Promise<AgentRuntimeBrowserActionResult>;
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
    saveAutoDispatchSettings(
        input: AgentRuntimeSaveAutoDispatchSettings
    ): Promise<AgentRuntimeAutoDispatchSettings>;
    saveBrowserSettings(
        input: AgentRuntimeSaveBrowserSettings
    ): Promise<AgentRuntimeBrowserSettings>;
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
    saveModelCapabilitySelections(
        input: AgentRuntimeSaveModelCapabilitySelections
    ): Promise<AgentRuntimeModelCapabilitySelectionSettings>;
    saveModelCategorySettings(
        input: AgentRuntimeSaveModelCategorySettings
    ): Promise<AgentRuntimeSaveModelCategorySettingsResult>;
    saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey): Promise<{ ok: boolean }>;
    saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings): Promise<AgentRuntimeOpenAiSettings>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveTimezoneSettings(
        input: AgentRuntimeSaveTimezoneSettings
    ): Promise<AgentRuntimeSaveTimezoneSettingsResult>;
    saveToolEnv(
        toolId: string,
        input: AgentRuntimeToolEnvUpdate
    ): Promise<AgentRuntimeToolEnvUpdateResult>;
    saveWikiPage(input: WikiSavePage): Promise<WikiPathMutationResult>;
    saveWikiSettings(
        input: AgentRuntimeSaveWikiSettings
    ): Promise<AgentRuntimeSaveWikiSettingsResult>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    scanSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubScan>;
    searchWiki(input: WikiSearchInput): Promise<WikiSearchResult>;
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
    setTaskWorkChat(taskId: string, input: AgentRuntimeSetTaskWorkChat): Promise<AgentRuntimeTask>;
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
    updateAgentBio(
        agentId: string,
        input: AgentRuntimeUpdateAgentBio
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentModel(
        agentId: string,
        input: AgentRuntimeUpdateAgentModel
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentName(
        agentId: string,
        input: AgentRuntimeUpdateAgentName
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentTaskSettings(
        agentId: string,
        input: AgentRuntimeUpdateAgentTaskSettings
    ): Promise<AgentRuntimeAgent>;
    updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateAgentWebSettings(
        agentId: string,
        input: AgentRuntimeUpdateAgentWebSettings
    ): Promise<AgentRuntimeAgent>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
    updateSkillEnabled(
        skillId: string,
        input: AgentRuntimeUpdateSkillEnabled
    ): Promise<AgentRuntimeSkill>;
    updateTask(taskId: string, input: AgentRuntimeUpdateTask): Promise<AgentRuntimeTask>;
    updateTaskLabel(
        labelId: string,
        input: AgentRuntimeUpdateTaskLabel
    ): Promise<AgentRuntimeTaskLabel>;
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

    async postWikiQuery<T>(route: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
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

    async dispatchTask(taskId: string, agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.taskDispatch(taskId)}`, {
            body: JSON.stringify({ agentId }),
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
        return agentRuntimeDispatchTaskResultSchema.parse(await response.json());
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

    async getTaskAttachment(taskId: string, attachmentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.taskAttachment(taskId, attachmentId)}`,
            { headers: this.#authHeaders }
        );
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeTaskAttachmentContentSchema.parse(await response.json());
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

    async setTaskWorkChat(taskId: string, input: AgentRuntimeSetTaskWorkChat) {
        const payload = agentRuntimeSetTaskWorkChatSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.taskWorkChat(taskId)}`, {
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

    async deleteTaskAttachment(taskId: string, attachmentId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.taskAttachment(taskId, attachmentId)}`,
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
        return (await response.json()) as { deleted: boolean; id: string };
    }

    async listTaskLabels() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.labels}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeTaskLabelListSchema.parse(await response.json());
    }

    async createTaskLabel(input: AgentRuntimeCreateTaskLabel) {
        const payload = agentRuntimeCreateTaskLabelSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.labels}`, {
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

        return agentRuntimeTaskLabelSchema.parse(await response.json());
    }

    async updateTaskLabel(labelId: string, input: AgentRuntimeUpdateTaskLabel) {
        const payload = agentRuntimeUpdateTaskLabelSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.label(labelId)}`, {
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

        return agentRuntimeTaskLabelSchema.parse(await response.json());
    }

    async deleteTaskLabel(labelId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.label(labelId)}`, {
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

    async getMemoryActivity() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memoryActivity}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return memoryActivityListSchema.parse(await response.json());
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

    async getWikiStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return wikiStatusSchema.parse(await response.json());
    }

    async getWikiSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeWikiSettingsSchema.parse(await response.json());
    }

    async saveWikiSettings(input: AgentRuntimeSaveWikiSettings) {
        const payload = agentRuntimeSaveWikiSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiSettings}`, {
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

        return agentRuntimeSaveWikiSettingsResultSchema.parse(await response.json());
    }

    async createWikiPage(input: WikiCreatePage) {
        const payload = wikiCreatePageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiPages}`, {
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async saveWikiPage(input: WikiSavePage) {
        const payload = wikiSavePageSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.wikiPage(payload.path)}`,
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async createWikiFolder(input: WikiPathInput) {
        const payload = wikiPathInputSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiFolders}`, {
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async listWikiPages() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiPages}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return wikiPageListSchema.parse(await response.json());
    }

    async getWikiPage(input: { path: string }) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiPage(input.path)}`, {
            headers: this.#authHeaders,
        });

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return wikiPageSchema.parse(await response.json());
    }

    async deleteWikiPage(input: WikiPathInput) {
        const payload = wikiPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.wikiPage(payload.path)}`,
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async deleteWikiFolder(input: WikiPathInput) {
        const payload = wikiPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.wikiFolder(payload.path)}`,
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async moveWikiPath(input: WikiMovePath) {
        const payload = wikiMovePathSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.wikiMovePath}`, {
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

        return wikiPathMutationResultSchema.parse(await response.json());
    }

    async searchWiki(input: WikiSearchInput) {
        return await this.postWikiQuery(
            agentRuntimeRoutes.wikiSearch,
            wikiSearchInputSchema.parse(input),
            wikiSearchResultSchema
        );
    }

    async listWikiBacklinks(input: { path: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.wikiBacklinks(input.path)}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return wikiBacklinkListSchema.parse(await response.json());
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

    async updateAgentBio(agentId: string, input: AgentRuntimeUpdateAgentBio) {
        const payload = agentRuntimeUpdateAgentBioSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentBio(agentId)}`, {
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

    async updateAgentTaskSettings(agentId: string, input: AgentRuntimeUpdateAgentTaskSettings) {
        const payload = agentRuntimeUpdateAgentTaskSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentTaskSettings(agentId)}`,
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
        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async updateAgentWebSettings(agentId: string, input: AgentRuntimeUpdateAgentWebSettings) {
        const payload = agentRuntimeUpdateAgentWebSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentWebSettings(agentId)}`,
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
        return agentRuntimeAgentSchema.parse(await response.json());
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

    async getAutoDispatchSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.taskDispatchSettings}`, {
            headers: this.#authHeaders,
        });
        if (!response.ok) {
            await readErrorResponse(response);
        }
        return agentRuntimeAutoDispatchSettingsSchema.parse(await response.json());
    }

    async saveAutoDispatchSettings(input: AgentRuntimeSaveAutoDispatchSettings) {
        const payload = agentRuntimeSaveAutoDispatchSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.taskDispatchSettings}`, {
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
        return agentRuntimeAutoDispatchSettingsSchema.parse(await response.json());
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

    async getModelCapabilitySelections() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCapabilitySelections}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelCapabilitySelectionSettingsSchema.parse(await response.json());
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

    async saveModelCapabilitySelections(input: AgentRuntimeSaveModelCapabilitySelections) {
        const payload = agentRuntimeSaveModelCapabilitySelectionsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelCapabilitySelections}`,
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

        return agentRuntimeModelCapabilitySelectionSettingsSchema.parse(await response.json());
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

    async getBrowserSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginBrowserSettings}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBrowserSettingsSchema.parse(await response.json());
    }

    async saveBrowserSettings(input: AgentRuntimeSaveBrowserSettings) {
        const payload = agentRuntimeSaveBrowserSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.pluginBrowserSettings}`,
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

        return agentRuntimeBrowserSettingsSchema.parse(await response.json());
    }

    async openBrowser() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.pluginBrowserOpen}`, {
            body: JSON.stringify({}),
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

        return agentRuntimeBrowserActionResultSchema.parse(await response.json());
    }

    async restartBrowser() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.pluginBrowserRestart}`, {
            body: JSON.stringify({}),
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

        return agentRuntimeBrowserActionResultSchema.parse(await response.json());
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
