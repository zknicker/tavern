import {
    type AgentRuntimeAgent,
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    type AgentRuntimeApplyHermesConfig,
    type AgentRuntimeApprovalRespond,
    type AgentRuntimeApprovalRespondResult,
    type AgentRuntimeArchiveAgent,
    type AgentRuntimeArchiveBinding,
    type AgentRuntimeArchiveCron,
    type AgentRuntimeBinding,
    type AgentRuntimeCancelModelProviderOAuth,
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeCapabilityHealthId,
    type AgentRuntimeCapabilityHealthList,
    type AgentRuntimeChat,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateCron,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeCronRun,
    type AgentRuntimeDeleteDiscordBinding,
    type AgentRuntimeDiscordBinding,
    type AgentRuntimeExecutionSettings,
    type AgentRuntimeHermesConfigSnapshot,
    type AgentRuntimeHighlightList,
    type AgentRuntimeJobDetail,
    type AgentRuntimeJobList,
    type AgentRuntimeJobSlug,
    type AgentRuntimeMacAppList,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeModelAccess,
    type AgentRuntimeModels,
    type AgentRuntimeOpenAiSettings,
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimePollModelProviderOAuth,
    type AgentRuntimeRenderedWorkspaceInstructions,
    type AgentRuntimeRunCron,
    type AgentRuntimeRunJob,
    type AgentRuntimeRunJobInput,
    type AgentRuntimeSaveAgentFile,
    type AgentRuntimeSaveDiscordBinding,
    type AgentRuntimeSaveExecutionSettings,
    type AgentRuntimeSaveExecutionSettingsResult,
    type AgentRuntimeSaveModelProviderApiKey,
    type AgentRuntimeSaveOpenAiSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveWorkspaceInstructions,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionList,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPreviewList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillSummary,
    type AgentRuntimeStartModelProviderOAuth,
    type AgentRuntimeStopTurn,
    type AgentRuntimeStopTurnResult,
    type AgentRuntimeSubmitModelProviderOAuth,
    type AgentRuntimeToolset,
    type AgentRuntimeToolsetList,
    type AgentRuntimeUpdate,
    type AgentRuntimeUpdateAgentModel,
    type AgentRuntimeUpdateAgentName,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeUpdateAgentTools,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateToolsetEnabled,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeWorkspaceInstructions,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentSchema,
    agentRuntimeApplyHermesConfigSchema,
    agentRuntimeApprovalRespondResultSchema,
    agentRuntimeApprovalRespondSchema,
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
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeDeleteDiscordBindingSchema,
    agentRuntimeDiscordBindingListSchema,
    agentRuntimeErrorSchema,
    agentRuntimeExecutionSettingsSchema,
    agentRuntimeHermesConfigSnapshotSchema,
    agentRuntimeHighlightListSchema,
    agentRuntimeJobDetailSchema,
    agentRuntimeJobListSchema,
    agentRuntimeJobSlugSchema,
    agentRuntimeMacAppListSchema,
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
    agentRuntimePollModelProviderOAuthSchema,
    agentRuntimeRenderedWorkspaceInstructionsSchema,
    agentRuntimeRoutes,
    agentRuntimeRunCronSchema,
    agentRuntimeRunJobInputSchema,
    agentRuntimeRunJobSchema,
    agentRuntimeSaveAgentFileSchema,
    agentRuntimeSaveDiscordBindingSchema,
    agentRuntimeSaveExecutionSettingsResultSchema,
    agentRuntimeSaveExecutionSettingsSchema,
    agentRuntimeSaveModelProviderApiKeySchema,
    agentRuntimeSaveOpenAiSettingsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPreviewListSchema,
    agentRuntimeSessionPromptSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeStartModelProviderOAuthSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeStopTurnSchema,
    agentRuntimeSubmitModelProviderOAuthSchema,
    agentRuntimeToolsetListSchema,
    agentRuntimeToolsetSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentToolsSchema,
    agentRuntimeUpdateCronSchema,
    agentRuntimeUpdateSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolsetEnabledSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    type CortexBacklinkList,
    type CortexPage,
    type CortexPageList,
    type CortexSearchInput,
    type CortexSearchResult,
    type CortexStatus,
    type CortexTopicList,
    cortexBacklinkListSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
    cortexTopicListSchema,
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
    applyHermesConfig(
        input: AgentRuntimeApplyHermesConfig
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    cancelModelProviderOAuth(input: AgentRuntimeCancelModelProviderOAuth): Promise<unknown>;
    close(): void;
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteDiscordBinding(
        bindingId: string,
        input: AgentRuntimeDeleteDiscordBinding
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    deleteOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    getCortexPage(input: { path: string; topic: string }): Promise<CortexPage | null>;
    getCortexStatus(): Promise<CortexStatus>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getExecutionSettings(): Promise<AgentRuntimeExecutionSettings>;
    getHermesConfig(): Promise<AgentRuntimeHermesConfigSnapshot>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenAiSettings(): Promise<AgentRuntimeOpenAiSettings>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getRuntimeJob(slug: AgentRuntimeJobSlug): Promise<AgentRuntimeJobDetail | null>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getUpdateStatus(): Promise<AgentRuntimeUpdate>;
    getWorkspaceInstructions(agentId: string): Promise<AgentRuntimeRenderedWorkspaceInstructions>;
    listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList>;
    listAgents(): Promise<{ agents: AgentRuntimeAgent[] }>;
    listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }>;
    listCapabilities(): Promise<AgentRuntimeCapabilityHealthList>;
    listChats(): Promise<{ chats: AgentRuntimeChat[] }>;
    listCortexBacklinks(input: { path: string; topic: string }): Promise<CortexBacklinkList>;
    listCortexPages(input?: {
        includeArchived?: boolean;
        topic?: string | null;
    }): Promise<CortexPageList>;
    listCortexTopics(input?: { includeArchived?: boolean }): Promise<CortexTopicList>;
    listCronJobs(): Promise<AgentRuntimeCronList>;
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listDiscordBindings(): Promise<{ bindings: AgentRuntimeDiscordBinding[] }>;
    listHighlights(): Promise<AgentRuntimeHighlightList>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listRuntimeJobs(): Promise<AgentRuntimeJobList>;
    listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ): Promise<AgentRuntimeSessionMessageList>;
    listSessionPreviews(
        input: AgentRuntimeListSessionPreviewsInput
    ): Promise<AgentRuntimeSessionPreviewList>;
    listSessions(): Promise<AgentRuntimeSessionList>;
    listSkills(
        options?: AgentRuntimeListSkillsOptions
    ): Promise<{ skills: AgentRuntimeSkillSummary[] }>;
    listToolsets(): Promise<AgentRuntimeToolsetList>;
    pollModelProviderOAuth(input: AgentRuntimePollModelProviderOAuth): Promise<unknown>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    refreshCapability(id: AgentRuntimeCapabilityHealthId): Promise<AgentRuntimeCapabilityHealth>;
    respondToChatApproval(
        sessionKey: string,
        input: AgentRuntimeApprovalRespond
    ): Promise<AgentRuntimeApprovalRespondResult>;
    restartForUpdate(): Promise<AgentRuntimeUpdate>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun>;
    runRuntimeJob(
        slug: AgentRuntimeJobSlug,
        input?: AgentRuntimeRunJobInput
    ): Promise<AgentRuntimeRunJob>;
    saveAgentFile(
        agentId: string,
        path: string,
        input: AgentRuntimeSaveAgentFile
    ): Promise<AgentRuntimeAgentFileContent>;
    saveDiscordBinding(
        input: AgentRuntimeSaveDiscordBinding
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    saveExecutionSettings(
        input: AgentRuntimeSaveExecutionSettings
    ): Promise<AgentRuntimeSaveExecutionSettingsResult>;
    saveModelProviderApiKey(input: AgentRuntimeSaveModelProviderApiKey): Promise<{ ok: boolean }>;
    saveOpenAiSettings(input: AgentRuntimeSaveOpenAiSettings): Promise<AgentRuntimeOpenAiSettings>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    searchCortex(input: CortexSearchInput): Promise<CortexSearchResult>;
    startModelProviderOAuth(input: AgentRuntimeStartModelProviderOAuth): Promise<unknown>;
    startUpdate(input?: { targetVersion?: null | string }): Promise<AgentRuntimeUpdate>;
    stopChatTurn(chatId: string, input: AgentRuntimeStopTurn): Promise<AgentRuntimeStopTurnResult>;
    submitModelProviderOAuth(input: AgentRuntimeSubmitModelProviderOAuth): Promise<unknown>;
    updateAgentModel(
        agentId: string,
        input: AgentRuntimeUpdateAgentModel
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    updateAgentName(
        agentId: string,
        input: AgentRuntimeUpdateAgentName
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    updateAgentThinkingDefault(
        agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    updateAgentTools(
        agentId: string,
        input: AgentRuntimeUpdateAgentTools
    ): Promise<AgentRuntimeHermesConfigSnapshot>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
    updateSkillEnabled(
        skillId: string,
        input: AgentRuntimeUpdateSkillEnabled
    ): Promise<AgentRuntimeSkill>;
    updateToolsetEnabled(
        toolsetId: string,
        input: AgentRuntimeUpdateToolsetEnabled
    ): Promise<AgentRuntimeToolset>;
    upsertAgent(input: AgentRuntimeCreateAgent): Promise<AgentRuntimeAgent>;
    upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding>;
}

export interface AgentRuntimeListSessionMessagesOptions {
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

    async postCortexQuery<T>(route: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
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

    async listHighlights() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.highlights}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeHighlightListSchema.parse(await response.json());
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

    async getCortexStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexStatus}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexStatusSchema.parse(await response.json());
    }

    async listCortexTopics(input: { includeArchived?: boolean } = {}) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.cortexTopics}`);
        if (input.includeArchived) {
            url.searchParams.set('includeArchived', 'true');
        }
        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexTopicListSchema.parse(await response.json());
    }

    async listCortexPages(input: { includeArchived?: boolean; topic?: string | null } = {}) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.cortexPages}`);
        if (input.includeArchived) {
            url.searchParams.set('includeArchived', 'true');
        }
        if (input.topic) {
            url.searchParams.set('topic', input.topic);
        }
        const response = await fetch(url, { headers: this.#authHeaders });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexPageListSchema.parse(await response.json());
    }

    async getCortexPage(input: { path: string; topic: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.cortexPage(input.topic, input.path)}`,
            { headers: this.#authHeaders }
        );

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexPageSchema.parse(await response.json());
    }

    async searchCortex(input: CortexSearchInput) {
        return await this.postCortexQuery(
            agentRuntimeRoutes.cortexSearch,
            cortexSearchInputSchema.parse(input),
            cortexSearchResultSchema
        );
    }

    async listCortexBacklinks(input: { path: string; topic: string }) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.cortexBacklinks(input.topic, input.path)}`,
            { headers: this.#authHeaders }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexBacklinkListSchema.parse(await response.json());
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

    async getHermesConfig() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.hermesConfig}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
    }

    async applyHermesConfig(input: AgentRuntimeApplyHermesConfig) {
        const payload = agentRuntimeApplyHermesConfigSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.hermesConfig}`, {
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.executionSettings}`);

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

    async listToolsets() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.toolsets}`, {
            headers: this.#authHeaders,
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeToolsetListSchema.parse(await response.json());
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

    async updateToolsetEnabled(toolsetId: string, input: AgentRuntimeUpdateToolsetEnabled) {
        const payload = agentRuntimeUpdateToolsetEnabledSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.toolsetEnabled(toolsetId)}`,
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

        return agentRuntimeToolsetSchema.parse(await response.json());
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

    async respondToChatApproval(
        sessionKey: string,
        input: AgentRuntimeApprovalRespond
    ): Promise<AgentRuntimeApprovalRespondResult> {
        const payload = agentRuntimeApprovalRespondSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionApprovalRespond(sessionKey)}`,
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

        return agentRuntimeApprovalRespondResultSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

        return agentRuntimeHermesConfigSnapshotSchema.parse(await response.json());
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

const legacyRuntimeCapabilityIds = new Set([
    'cortexDatabase',
    'cortexImportProcessors',
    'cortexJobs',
    'cortexModelAccess',
    'embeddingModel',
]);

function parseAgentRuntimeCapabilityHealthList(input: unknown): AgentRuntimeCapabilityHealthList {
    return agentRuntimeCapabilityHealthListSchema.parse(filterLegacyRuntimeCapabilities(input));
}

function filterLegacyRuntimeCapabilities(input: unknown): unknown {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return input;
    }
    const record = input as Record<string, unknown>;
    if (!Array.isArray(record.capabilities)) {
        return input;
    }
    return {
        ...record,
        capabilities: record.capabilities.filter((capability) => !isLegacyCapability(capability)),
    };
}

function isLegacyCapability(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return false;
    }
    const id = (input as Record<string, unknown>).id;
    return typeof id === 'string' && legacyRuntimeCapabilityIds.has(id);
}
