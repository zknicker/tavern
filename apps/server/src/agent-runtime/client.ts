import {
    type AgentRuntimeAgent,
    type AgentRuntimeAgentEngineConfigSnapshot,
    type AgentRuntimeAgentEnv,
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
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
    type AgentRuntimeCommandList,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateCron,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeCronRun,
    type AgentRuntimeCurrentAgentSessionResult,
    type AgentRuntimeDeleteDiscordBinding,
    type AgentRuntimeDiscordBinding,
    type AgentRuntimeEventList,
    type AgentRuntimeExecutionSettings,
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
    type AgentRuntimeMerchbaseActionInput,
    type AgentRuntimeMerchbaseActionResult,
    type AgentRuntimeMerchbaseSalesSeries,
    type AgentRuntimeMerchbaseSalesSeriesInput,
    type AgentRuntimeMerchbaseSettings,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeModelAccess,
    type AgentRuntimeModels,
    type AgentRuntimeOpenAiSettings,
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimePlugin,
    type AgentRuntimePluginId,
    type AgentRuntimePluginList,
    type AgentRuntimePollModelProviderOAuth,
    type AgentRuntimeRenderedWorkspaceInstructions,
    type AgentRuntimeRunCommand,
    type AgentRuntimeRunCommandResult,
    type AgentRuntimeRunCron,
    type AgentRuntimeRunJob,
    type AgentRuntimeRunJobInput,
    type AgentRuntimeSaveAgentEnv,
    type AgentRuntimeSaveAgentEnvResult,
    type AgentRuntimeSaveAgentFile,
    type AgentRuntimeSaveDiscordBinding,
    type AgentRuntimeSaveExecutionSettings,
    type AgentRuntimeSaveExecutionSettingsResult,
    type AgentRuntimeSaveMerchbaseSettings,
    type AgentRuntimeSaveModelProviderApiKey,
    type AgentRuntimeSaveOpenAiSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveVaultSettings,
    type AgentRuntimeSaveVaultSettingsResult,
    type AgentRuntimeSaveWorkspaceInstructions,
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
    type AgentRuntimeSkillSummary,
    type AgentRuntimeStartModelProviderOAuth,
    type AgentRuntimeSteerTurn,
    type AgentRuntimeSteerTurnResult,
    type AgentRuntimeStopTurn,
    type AgentRuntimeStopTurnResult,
    type AgentRuntimeSubmitModelProviderOAuth,
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
    type AgentRuntimeUpdateAgentSessionModel,
    type AgentRuntimeUpdateAgentSessionModelResult,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeUpdateAgentTools,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateToolEnabled,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeVaultSettings,
    type AgentRuntimeWorkspaceFileContent,
    type AgentRuntimeWorkspaceFileList,
    type AgentRuntimeWorkspaceFileListInput,
    type AgentRuntimeWorkspaceInstructions,
    agentRuntimeAgentEngineConfigSnapshotSchema,
    agentRuntimeAgentEnvSchema,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
    agentRuntimeAgentListSchema,
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
    agentRuntimeCommandListSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeDeleteDiscordBindingSchema,
    agentRuntimeDiscordBindingListSchema,
    agentRuntimeErrorSchema,
    agentRuntimeExecutionSettingsSchema,
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
    agentRuntimeMerchbaseActionInputSchema,
    agentRuntimeMerchbaseActionResultSchema,
    agentRuntimeMerchbaseSalesSeriesInputSchema,
    agentRuntimeMerchbaseSalesSeriesSchema,
    agentRuntimeMerchbaseSettingsSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeModelAccessSchema,
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
    agentRuntimeRoutes,
    agentRuntimeRunCommandResultSchema,
    agentRuntimeRunCommandSchema,
    agentRuntimeRunCronSchema,
    agentRuntimeRunJobInputSchema,
    agentRuntimeRunJobSchema,
    agentRuntimeSaveAgentEnvResultSchema,
    agentRuntimeSaveAgentEnvSchema,
    agentRuntimeSaveAgentFileSchema,
    agentRuntimeSaveDiscordBindingSchema,
    agentRuntimeSaveExecutionSettingsResultSchema,
    agentRuntimeSaveExecutionSettingsSchema,
    agentRuntimeSaveMerchbaseSettingsSchema,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSaveOpenAiSettingsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveVaultSettingsResultSchema,
    agentRuntimeSaveVaultSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
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
    agentRuntimeSkillSchema,
    agentRuntimeStartModelProviderOAuthSchema,
    agentRuntimeSteerTurnResultSchema,
    agentRuntimeSteerTurnSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
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
    agentRuntimeUpdateAgentSessionModelResultSchema,
    agentRuntimeUpdateAgentSessionModelSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentToolsSchema,
    agentRuntimeUpdateCronSchema,
    agentRuntimeUpdateSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolEnabledSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeVaultSettingsSchema,
    agentRuntimeWorkspaceFileContentSchema,
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFileListSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    runtimeEventListSchema,
    type VaultBacklinkList,
    type VaultCreatePage,
    type VaultMovePath,
    type VaultPage,
    type VaultPageList,
    type VaultPathInput,
    type VaultPathMutationResult,
    type VaultSavePage,
    type VaultSearchInput,
    type VaultSearchResult,
    type VaultStatus,
    vaultBacklinkListSchema,
    vaultCreatePageSchema,
    vaultMovePathSchema,
    vaultPageListSchema,
    vaultPageSchema,
    vaultPathInputSchema,
    vaultPathMutationResultSchema,
    vaultSavePageSchema,
    vaultSearchInputSchema,
    vaultSearchResultSchema,
    vaultStatusSchema,
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
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    createVaultFolder(input: VaultPathInput): Promise<VaultPathMutationResult>;
    createVaultPage(input: VaultCreatePage): Promise<VaultPathMutationResult>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteDiscordBinding(
        bindingId: string,
        input: AgentRuntimeDeleteDiscordBinding
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    deleteOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    deleteVaultFolder(input: VaultPathInput): Promise<VaultPathMutationResult>;
    deleteVaultPage(input: VaultPathInput): Promise<VaultPathMutationResult>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentEngineConfig(): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    getAgentEnv(): Promise<AgentRuntimeAgentEnv>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getCurrentAgentSession(input: {
        agentParticipantId?: string;
        chatId: string;
    }): Promise<AgentRuntimeCurrentAgentSessionResult>;
    getExecutionSettings(): Promise<AgentRuntimeExecutionSettings>;
    getMcpCatalog(): Promise<AgentRuntimeMcpCatalog>;
    getMerchbaseSettings(): Promise<AgentRuntimeMerchbaseSettings>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getPlugin(id: AgentRuntimePluginId): Promise<AgentRuntimePlugin>;
    getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail | null>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getSkill(skillId: string): Promise<AgentRuntimeSkill>;
    getSkillHubAvailable(): Promise<AgentRuntimeSkillHubAvailable>;
    getToolConfig(toolId: string): Promise<AgentRuntimeToolConfig>;
    getUpdateStatus(): Promise<AgentRuntimeUpdate>;
    getVaultPage(input: { path: string }): Promise<VaultPage | null>;
    getVaultSettings(): Promise<AgentRuntimeVaultSettings>;
    getVaultStatus(): Promise<VaultStatus>;
    getWorkspaceFile(agentId: string, path: string): Promise<AgentRuntimeWorkspaceFileContent>;
    getWorkspaceInstructions(agentId: string): Promise<AgentRuntimeRenderedWorkspaceInstructions>;
    installMcpCatalogEntry(
        input: AgentRuntimeMcpCatalogInstall
    ): Promise<AgentRuntimeSkillHubActionResult>;
    installSkillHubSkill(
        input: AgentRuntimeSkillHubInstallInput
    ): Promise<AgentRuntimeSkillHubActionResult>;
    listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList>;
    listAgents(): Promise<{ agents: AgentRuntimeAgent[] }>;
    listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }>;
    listCapabilities(): Promise<AgentRuntimeCapabilityHealthList>;
    listChats(): Promise<{ chats: AgentRuntimeChat[] }>;
    listCommands(): Promise<AgentRuntimeCommandList>;
    listCronJobs(): Promise<AgentRuntimeCronList>;
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listDiscordBindings(): Promise<{ bindings: AgentRuntimeDiscordBinding[] }>;
    listEvents(input?: AgentRuntimeListEventsInput): Promise<AgentRuntimeEventList>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listMcpServers(): Promise<AgentRuntimeMcpServerList>;
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
    listTools(): Promise<AgentRuntimeToolList>;
    listVaultBacklinks(input: { path: string }): Promise<VaultBacklinkList>;
    listVaultPages(): Promise<VaultPageList>;
    listWorkspaceFiles(
        agentId: string,
        input?: AgentRuntimeWorkspaceFileListInput
    ): Promise<AgentRuntimeWorkspaceFileList>;
    moveVaultPath(input: VaultMovePath): Promise<VaultPathMutationResult>;
    pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth): Promise<unknown>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    previewSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubPreview>;
    queryMerchbaseAction(
        input: AgentRuntimeMerchbaseActionInput
    ): Promise<AgentRuntimeMerchbaseActionResult>;
    queryMerchbaseSalesSeries(
        input: AgentRuntimeMerchbaseSalesSeriesInput
    ): Promise<AgentRuntimeMerchbaseSalesSeries>;
    refreshCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    removeMcpServer(name: string): Promise<{ ok: boolean }>;
    removeSkillHubTap(repo: string): Promise<AgentRuntimeSkillHubTapList>;
    restartForUpdate(): Promise<AgentRuntimeUpdate>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runCommand(input: AgentRuntimeRunCommand): Promise<AgentRuntimeRunCommandResult>;
    runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun>;
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
    saveExecutionSettings(
        input: AgentRuntimeSaveExecutionSettings
    ): Promise<AgentRuntimeSaveExecutionSettingsResult>;
    saveMerchbaseSettings(
        input: AgentRuntimeSaveMerchbaseSettings
    ): Promise<AgentRuntimeMerchbaseSettings>;
    saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey): Promise<{ ok: boolean }>;
    saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings): Promise<AgentRuntimeOpenAiSettings>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveToolEnv(
        toolId: string,
        input: AgentRuntimeToolEnvUpdate
    ): Promise<AgentRuntimeToolEnvUpdateResult>;
    saveVaultPage(input: VaultSavePage): Promise<VaultPathMutationResult>;
    saveVaultSettings(
        input: AgentRuntimeSaveVaultSettings
    ): Promise<AgentRuntimeSaveVaultSettingsResult>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    scanSkillHubSkill(identifier: string): Promise<AgentRuntimeSkillHubScan>;
    searchVault(input: VaultSearchInput): Promise<VaultSearchResult>;
    selectToolProvider(
        toolId: string,
        input: AgentRuntimeToolProviderSelect
    ): Promise<AgentRuntimeToolProviderSelectResult>;
    setMcpServerEnabled(name: string, enabled: boolean): Promise<{ ok: boolean }>;
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
    updateAgentTools(
        agentId: string,
        input: AgentRuntimeUpdateAgentTools
    ): Promise<AgentRuntimeAgentEngineConfigSnapshot>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
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

    async postVaultQuery<T>(route: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
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

    async listCapabilities() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.capabilities}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return parseAgentRuntimeCapabilityHealthList(await response.json());
    }

    async listCommands() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.commands}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCommandListSchema.parse(await response.json());
    }

    async runCommand(input: AgentRuntimeRunCommand) {
        const payload = agentRuntimeRunCommandSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.commandsRun}`, {
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

        return agentRuntimeRunCommandResultSchema.parse(await response.json());
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

    async getVaultStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return vaultStatusSchema.parse(await response.json());
    }

    async getVaultSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeVaultSettingsSchema.parse(await response.json());
    }

    async saveVaultSettings(input: AgentRuntimeSaveVaultSettings) {
        const payload = agentRuntimeSaveVaultSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultSettings}`, {
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

        return agentRuntimeSaveVaultSettingsResultSchema.parse(await response.json());
    }

    async createVaultPage(input: VaultCreatePage) {
        const payload = vaultCreatePageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultPages}`, {
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async saveVaultPage(input: VaultSavePage) {
        const payload = vaultSavePageSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.vaultPage(payload.path)}`,
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async createVaultFolder(input: VaultPathInput) {
        const payload = vaultPathInputSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultFolders}`, {
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async listVaultPages() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultPages}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return vaultPageListSchema.parse(await response.json());
    }

    async getVaultPage(input: { path: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.vaultPage(input.path)}`,
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

        return vaultPageSchema.parse(await response.json());
    }

    async deleteVaultPage(input: VaultPathInput) {
        const payload = vaultPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.vaultPage(payload.path)}`,
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async deleteVaultFolder(input: VaultPathInput) {
        const payload = vaultPathInputSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.vaultFolder(payload.path)}`,
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async moveVaultPath(input: VaultMovePath) {
        const payload = vaultMovePathSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.vaultMovePath}`, {
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

        return vaultPathMutationResultSchema.parse(await response.json());
    }

    async searchVault(input: VaultSearchInput) {
        return await this.postVaultQuery(
            agentRuntimeRoutes.vaultSearch,
            vaultSearchInputSchema.parse(input),
            vaultSearchResultSchema
        );
    }

    async listVaultBacklinks(input: { path: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.vaultBacklinks(input.path)}`,
            {
                headers: this.#authHeaders,
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return vaultBacklinkListSchema.parse(await response.json());
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

    async updateAgentTools(agentId: string, input: AgentRuntimeUpdateAgentTools) {
        const payload = agentRuntimeUpdateAgentToolsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentTools(agentId)}`, {
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

    async getModelAccess() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccess}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessSchema.parse(await response.json());
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

    async getExecutionSettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.executionSettings}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeExecutionSettingsSchema.parse(await response.json());
    }

    async saveExecutionSettings(input: AgentRuntimeSaveExecutionSettings) {
        const payload = agentRuntimeSaveExecutionSettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.executionSettings}`, {
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

        return agentRuntimeSaveExecutionSettingsResultSchema.parse(await response.json());
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

    async getCurrentAgentSession(input: { agentParticipantId?: string; chatId: string }) {
        const url = new URL(
            `${this.#baseUrl}${agentRuntimeRoutes.chatAgentSessionCurrent(input.chatId)}`
        );

        if (input.agentParticipantId) {
            url.searchParams.set('agentParticipantId', input.agentParticipantId);
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
