import {
    type AgentRuntimeAgent,
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    type AgentRuntimeApplyOpenClawConfig,
    type AgentRuntimeArchiveAgent,
    type AgentRuntimeArchiveBinding,
    type AgentRuntimeArchiveCron,
    type AgentRuntimeArchiveSkill,
    type AgentRuntimeBinding,
    type AgentRuntimeChat,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateCron,
    type AgentRuntimeCreateMessage,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeCronRun,
    type AgentRuntimeInstallSkill,
    type AgentRuntimeMacAppList,
    type AgentRuntimeMemorySettings,
    type AgentRuntimeMemoryStatus,
    type AgentRuntimeMessageAccepted,
    type AgentRuntimeModelAccess,
    type AgentRuntimeModelAccessStatus,
    type AgentRuntimeModels,
    type AgentRuntimeOpenClawConfigSnapshot,
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimeRunCron,
    type AgentRuntimeSaveAgentFile,
    type AgentRuntimeSaveClaudeCredential,
    type AgentRuntimeSaveCodexCredential,
    type AgentRuntimeSaveModels,
    type AgentRuntimeSaveOpenRouterSettings,
    type AgentRuntimeSaveWorkspaceInstructions,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionList,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillSummary,
    type AgentRuntimeStatus,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpsertBinding,
    type AgentRuntimeWorkspaceInstructions,
    agentRuntimeAgentFileContentSchema,
    agentRuntimeAgentFileListSchema,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentSchema,
    agentRuntimeApplyOpenClawConfigSchema,
    agentRuntimeArchiveAgentSchema,
    agentRuntimeArchiveBindingSchema,
    agentRuntimeArchiveCronSchema,
    agentRuntimeArchiveSkillSchema,
    agentRuntimeBindingListSchema,
    agentRuntimeBindingSchema,
    agentRuntimeChatListSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeCreateCronSchema,
    agentRuntimeCreateMessageSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeErrorSchema,
    agentRuntimeInstallSkillSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMemorySettingsSchema,
    agentRuntimeMemoryStatusSchema,
    agentRuntimeMessageAcceptedSchema,
    agentRuntimeModelAccessSchema,
    agentRuntimeModelAccessStatusSchema,
    agentRuntimeModelsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeOpenClawConfigSnapshotSchema,
    agentRuntimeOpenRouterSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeRunCronSchema,
    agentRuntimeSaveAgentFileSchema,
    agentRuntimeSaveClaudeCredentialSchema,
    agentRuntimeSaveCodexCredentialSchema,
    agentRuntimeSaveMemorySettingsSchema,
    agentRuntimeSaveModelsSchema,
    agentRuntimeSaveOpenRouterSettingsSchema,
    agentRuntimeSaveWorkspaceInstructionsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPromptSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeStatusSchema,
    agentRuntimeUpdateCronSchema,
    agentRuntimeUpsertBindingSchema,
    agentRuntimeWorkspaceInstructionsSchema,
    type CortexBacklinkList,
    type CortexCaptureInput,
    type CortexCaptureResult,
    type CortexJobName,
    type CortexJobRun,
    type CortexPage,
    type CortexPageList,
    type CortexRecallInput,
    type CortexRecallResult,
    type CortexSearchInput,
    type CortexSearchResult,
    type CortexStatus,
    cortexBacklinkListSchema,
    cortexCaptureInputSchema,
    cortexCaptureResultSchema,
    cortexJobRunSchema,
    cortexPageListSchema,
    cortexPageSchema,
    cortexRecallInputSchema,
    cortexRecallResultSchema,
    cortexSearchInputSchema,
    cortexSearchResultSchema,
    cortexStatusSchema,
} from '@tavern/api';
import { z } from 'zod';

const agentRuntimeClientOptionsSchema = z.object({
    baseUrl: z.string().url(),
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
    applyOpenClawConfig(
        input: AgentRuntimeApplyOpenClawConfig
    ): Promise<AgentRuntimeOpenClawConfigSnapshot>;
    captureCortex(input: CortexCaptureInput): Promise<CortexCaptureResult>;
    close(): void;
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    deleteSkill(skillId: string): Promise<AgentRuntimeArchiveSkill>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getCortexPage(slugOrId: string): Promise<CortexPage | null>;
    getCortexStatus(): Promise<CortexStatus>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getMemorySettings(): Promise<AgentRuntimeMemorySettings>;
    getMemoryStatus(): Promise<AgentRuntimeMemoryStatus>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenClawConfig(): Promise<AgentRuntimeOpenClawConfigSnapshot>;
    getOpenClawGatewayStatus(): Promise<AgentRuntimeStatus>;
    getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph>;
    getSessionPrompt(sessionKey: string): Promise<AgentRuntimeSessionPrompt | null>;
    getSkillConfig(skillId: string): Promise<AgentRuntimeSkill>;
    getStatus(): Promise<AgentRuntimeStatus>;
    installSkill(input: AgentRuntimeInstallSkill): Promise<AgentRuntimeSkill>;
    listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList>;
    listAgents(): Promise<{ agents: AgentRuntimeAgent[] }>;
    listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }>;
    listChats(): Promise<{ chats: AgentRuntimeChat[] }>;
    listCortexBacklinks(slugOrId: string): Promise<CortexBacklinkList>;
    listCortexPages(): Promise<CortexPageList>;
    listCronJobs(): Promise<AgentRuntimeCronList>;
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listMacApps(options?: { limit?: number; query?: string }): Promise<AgentRuntimeMacAppList>;
    listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ): Promise<AgentRuntimeSessionMessageList>;
    listSessions(): Promise<AgentRuntimeSessionList>;
    listSkills(
        options?: AgentRuntimeListSkillsOptions
    ): Promise<{ skills: AgentRuntimeSkillSummary[] }>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    recallCortex(input: CortexRecallInput): Promise<CortexRecallResult>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runCortexJob(job: CortexJobName): Promise<CortexJobRun>;
    runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun>;
    saveAgentFile(
        agentId: string,
        path: string,
        input: AgentRuntimeSaveAgentFile
    ): Promise<AgentRuntimeAgentFileContent>;
    saveClaudeCredential(
        input: AgentRuntimeSaveClaudeCredential
    ): Promise<AgentRuntimeModelAccessStatus>;
    saveCodexCredential(
        input: AgentRuntimeSaveCodexCredential
    ): Promise<AgentRuntimeModelAccessStatus>;
    saveMemorySettings(
        input: Omit<AgentRuntimeMemorySettings, 'updatedAt'>
    ): Promise<AgentRuntimeMemorySettings>;
    saveModels(input: AgentRuntimeSaveModels): Promise<AgentRuntimeModels>;
    saveOpenRouterSettings(
        input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings>;
    saveWorkspaceInstructions(
        agentId: string,
        input: AgentRuntimeSaveWorkspaceInstructions
    ): Promise<AgentRuntimeWorkspaceInstructions>;
    searchCortex(input: CortexSearchInput): Promise<CortexSearchResult>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
    upsertAgent(input: AgentRuntimeCreateAgent): Promise<AgentRuntimeAgent>;
    upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding>;
}

export interface AgentRuntimeListSessionMessagesOptions {
    limit?: number;
}

export interface AgentRuntimeListSkillsOptions {
    agentId?: string;
}

interface AgentRuntimeClientOptions {
    baseUrl: string;
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

    constructor(options: AgentRuntimeClientOptions) {
        const parsed = agentRuntimeClientOptionsSchema.parse(options);
        this.#baseUrl = trimTrailingSlash(parsed.baseUrl);
    }

    close() {}

    async postCortexQuery<T>(route: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
        const response = await fetch(`${this.#baseUrl}${route}`, {
            body: JSON.stringify(input),
            headers: { 'content-type': 'application/json' },
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
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentConfig(agentId)}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentSchema.parse(await response.json());
    }

    async listAgentFiles(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agentFiles(agentId)}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentFileListSchema.parse(await response.json());
    }

    async getAgentFile(agentId: string, path: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.agentFile(agentId, path)}`
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

    async listAgents() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agents}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeAgentListSchema.parse(await response.json());
    }

    async deleteAgent(agentId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.agent(agentId)}`, {
            headers: {
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
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJob(jobId)}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronSchema.parse(await response.json());
    }

    async listCronJobs() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cronJobs}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeCronListSchema.parse(await response.json());
    }

    async listCronRuns(jobId?: string) {
        const route = jobId ? agentRuntimeRoutes.cronJobRuns(jobId) : agentRuntimeRoutes.cronRuns;
        const response = await fetch(`${this.#baseUrl}${route}`);

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

    async getMemorySettings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memorySettings}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMemorySettingsSchema.parse(await response.json());
    }

    async saveMemorySettings(input: Omit<AgentRuntimeMemorySettings, 'updatedAt'>) {
        const payload = agentRuntimeSaveMemorySettingsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memorySettings}`, {
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

        return agentRuntimeMemorySettingsSchema.parse(await response.json());
    }

    async getMemoryStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.memoryStatus}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMemoryStatusSchema.parse(await response.json());
    }

    async getCortexStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexStatus}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexStatusSchema.parse(await response.json());
    }

    async listCortexPages() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexPages}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexPageListSchema.parse(await response.json());
    }

    async getCortexPage(slugOrId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexPage(slugOrId)}`);

        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexPageSchema.parse(await response.json());
    }

    async captureCortex(input: CortexCaptureInput) {
        const payload = cortexCaptureInputSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexCapture}`, {
            body: JSON.stringify(payload),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexCaptureResultSchema.parse(await response.json());
    }

    async searchCortex(input: CortexSearchInput) {
        return await this.postCortexQuery(
            agentRuntimeRoutes.cortexSearch,
            cortexSearchInputSchema.parse(input),
            cortexSearchResultSchema
        );
    }

    async recallCortex(input: CortexRecallInput) {
        return await this.postCortexQuery(
            agentRuntimeRoutes.cortexRecall,
            cortexRecallInputSchema.parse(input),
            cortexRecallResultSchema
        );
    }

    async listCortexBacklinks(slugOrId: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.cortexBacklinks(slugOrId)}`
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexBacklinkListSchema.parse(await response.json());
    }

    async runCortexJob(job: CortexJobName) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.cortexJobRun(job)}`, {
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return cortexJobRunSchema.parse(await response.json());
    }

    async getModels() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.models}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelsSchema.parse(await response.json());
    }

    async getOpenClawConfig() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.openClawConfig}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenClawConfigSnapshotSchema.parse(await response.json());
    }

    async applyOpenClawConfig(input: AgentRuntimeApplyOpenClawConfig) {
        const payload = agentRuntimeApplyOpenClawConfigSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.openClawConfig}`, {
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

        return agentRuntimeOpenClawConfigSnapshotSchema.parse(await response.json());
    }

    async getModelAccess() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.modelAccess}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessSchema.parse(await response.json());
    }

    async saveClaudeCredential(input: AgentRuntimeSaveClaudeCredential) {
        const payload = agentRuntimeSaveClaudeCredentialSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessClaudeCredential}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessStatusSchema.parse(await response.json());
    }

    async saveCodexCredential(input: AgentRuntimeSaveCodexCredential) {
        const payload = agentRuntimeSaveCodexCredentialSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessCodexCredential}`,
            {
                body: JSON.stringify(payload),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            }
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeModelAccessStatusSchema.parse(await response.json());
    }

    async getOpenRouterSettings() {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeOpenRouterSettingsSchema.parse(await response.json());
    }

    async saveOpenRouterSettings(input: AgentRuntimeSaveOpenRouterSettings) {
        const payload = agentRuntimeSaveOpenRouterSettingsSchema.parse(input);
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.modelAccessOpenRouterSettings}`,
            {
                body: JSON.stringify(payload),
                headers: {
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

    async saveModels(input: AgentRuntimeSaveModels) {
        const payload = agentRuntimeSaveModelsSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.models}`, {
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

        return agentRuntimeModelsSchema.parse(await response.json());
    }

    async installSkill(input: AgentRuntimeInstallSkill) {
        const payload = agentRuntimeInstallSkillSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.skillInstall}`, {
            body: JSON.stringify(payload),
            headers: {
                'content-type': 'application/json',
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async getSkillConfig(skillId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.skillConfig(skillId)}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillSchema.parse(await response.json());
    }

    async listSkills(options?: AgentRuntimeListSkillsOptions) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.skills}`);
        if (options?.agentId) {
            url.searchParams.set('agentId', options.agentId);
        }
        const response = await fetch(url);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSkillListSchema.parse(await response.json());
    }

    async listMacApps(options?: { limit?: number; query?: string }) {
        const url = new URL(`${this.#baseUrl}${agentRuntimeRoutes.macApps}`);

        if (options?.query) {
            url.searchParams.set('query', options.query);
        }

        if (options?.limit !== undefined) {
            url.searchParams.set('limit', String(options.limit));
        }

        const response = await fetch(url);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMacAppListSchema.parse(await response.json());
    }

    async deleteSkill(skillId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.skill(skillId)}`, {
            headers: {
                [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
            },
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveSkillSchema.parse(await response.json());
    }

    async postMessage(chatId: string, input: AgentRuntimeCreateMessage) {
        const payload = agentRuntimeCreateMessageSchema.parse(input);
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chatMessages(chatId)}`, {
            body: JSON.stringify(payload),
            headers: {
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeMessageAcceptedSchema.parse(await response.json());
    }

    async listChats() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.chats}`);

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
                'content-type': 'application/json',
            },
            method: 'POST',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingSchema.parse(await response.json());
    }

    async listBindings() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.bindings}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeBindingListSchema.parse(await response.json());
    }

    async deleteBinding(bindingId: string) {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.binding(bindingId)}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeArchiveBindingSchema.parse(await response.json());
    }

    async getStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.status}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeStatusSchema.parse(await response.json());
    }

    async getOpenClawGatewayStatus() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.openClawGatewayStatus}`);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeStatusSchema.parse(await response.json());
    }

    async listSessions() {
        const response = await fetch(`${this.#baseUrl}${agentRuntimeRoutes.sessions}`);

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

        const response = await fetch(url);

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionMessageListSchema.parse(await response.json());
    }

    async getSessionGraph(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionGraph(sessionKey)}`
        );

        if (!response.ok) {
            await readErrorResponse(response);
        }

        return agentRuntimeSessionGraphSchema.parse(await response.json());
    }

    async getSessionPrompt(sessionKey: string) {
        const response = await fetch(
            `${this.#baseUrl}${agentRuntimeRoutes.sessionPrompt(sessionKey)}`
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

export function createAgentRuntimeClient(baseUrl: string): TavernAgentRuntimeClient {
    return new HttpTavernAgentRuntimeClient({
        baseUrl,
    });
}
