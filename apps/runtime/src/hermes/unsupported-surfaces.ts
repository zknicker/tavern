import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentFileContent,
    AgentRuntimeAgentFileList,
    AgentRuntimeApplyHermesConfig,
    AgentRuntimeArchiveAgent,
    AgentRuntimeArchiveBinding,
    AgentRuntimeArchiveCron,
    AgentRuntimeBinding,
    AgentRuntimeChat,
    AgentRuntimeCreateAgent,
    AgentRuntimeCreateCron,
    AgentRuntimeCreateMessage,
    AgentRuntimeCron,
    AgentRuntimeCronList,
    AgentRuntimeCronRun,
    AgentRuntimeHermesConfigSnapshot,
    AgentRuntimeMessageAccepted,
    AgentRuntimeModelAccess,
    AgentRuntimeOpenRouterSettings,
    AgentRuntimeRunCron,
    AgentRuntimeSaveOpenRouterSettings,
    AgentRuntimeUpdateAgentTools,
    AgentRuntimeUpdateCron,
    AgentRuntimeUpsertBinding,
} from '@tavern/api';
import { agentRuntimeChatListSchema } from '@tavern/api';
import { unsupportedHermesSurface } from './errors';

export class LocalHermesUnsupportedSurfaces {
    close() {}

    async upsertAgent(input: AgentRuntimeCreateAgent) {
        return {
            avatar: input.avatar ?? null,
            enabledSkillIds: input.enabledSkillIds ?? [],
            emoji: input.emoji ?? null,
            id: input.id,
            isAdmin: input.isAdmin ?? false,
            name: input.name,
            primaryColor: input.primaryColor ?? null,
            workspaceFolder: input.workspaceFolder,
        } satisfies AgentRuntimeAgent;
    }

    async updateAgentTools(
        _agentId: string,
        _input: AgentRuntimeUpdateAgentTools
    ): Promise<AgentRuntimeHermesConfigSnapshot> {
        throw unsupportedHermesSurface('Hermes agent tool policy');
    }

    async deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent> {
        return { archived: true, id: agentId };
    }

    async listAgentFiles(_agentId: string): Promise<AgentRuntimeAgentFileList> {
        return { files: [] };
    }

    async getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent> {
        throw unsupportedHermesSurface(`Hermes agent file ${agentId}:${path}`);
    }

    async saveAgentFile(
        agentId: string,
        path: string,
        _input: { content: string }
    ): Promise<AgentRuntimeAgentFileContent> {
        throw unsupportedHermesSurface(`Hermes agent file ${agentId}:${path}`);
    }

    async listChats() {
        return agentRuntimeChatListSchema.parse({
            chats: [] satisfies AgentRuntimeChat[],
        });
    }

    async postMessage(
        _chatId: string,
        _input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted> {
        throw unsupportedHermesSurface('direct non-Tavern Hermes message posting');
    }

    async createCronJob(_input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron> {
        throw unsupportedHermesSurface('Hermes cron mutation');
    }

    async updateCronJob(_jobId: string, _input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron> {
        throw unsupportedHermesSurface('Hermes cron mutation');
    }

    async deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron> {
        return { archived: true, id: jobId };
    }

    async getCronJob(_jobId: string): Promise<AgentRuntimeCron> {
        throw unsupportedHermesSurface('Hermes cron lookup');
    }

    async listCronJobs(): Promise<AgentRuntimeCronList> {
        return { jobs: [] };
    }

    async runCronJob(_jobId: string, _input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun> {
        throw unsupportedHermesSurface('Hermes cron run');
    }

    async listCronRuns(_jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }> {
        return { runs: [] };
    }

    async getHermesConfig(): Promise<AgentRuntimeHermesConfigSnapshot> {
        return {
            config: {},
            hash: 'hermes-adapter-unsupported',
            issues: ['Managed Hermes does not expose raw config mutation through Tavern.'],
            raw: null,
            valid: false,
        };
    }

    async applyHermesConfig(
        _input: AgentRuntimeApplyHermesConfig
    ): Promise<AgentRuntimeHermesConfigSnapshot> {
        throw unsupportedHermesSurface('Hermes raw config mutation');
    }

    async listBindings(): Promise<{ bindings: AgentRuntimeBinding[] }> {
        return { bindings: [] };
    }

    async upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding> {
        return {
            agentId: input.agentId,
            enabled: input.enabled ?? true,
            id: input.id,
            inboundMode: input.inboundMode ?? 'observe',
            match: input.match ?? {},
            metadata: input.metadata ?? {},
            name: input.name,
            platform: input.platform,
            status: input.status ?? 'disabled',
            statusMessage: input.statusMessage ?? 'Hermes does not own Tavern bindings.',
            token: input.token,
            updatedAt: new Date().toISOString(),
        };
    }

    async deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding> {
        return { archived: true, id: bindingId };
    }

    async getModelAccess(): Promise<AgentRuntimeModelAccess> {
        return { providers: [] };
    }

    async getOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings> {
        throw unsupportedHermesSurface('OpenRouter settings');
    }

    async saveOpenRouterSettings(
        _input: AgentRuntimeSaveOpenRouterSettings
    ): Promise<AgentRuntimeOpenRouterSettings> {
        throw unsupportedHermesSurface('OpenRouter settings');
    }

    async deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings> {
        throw unsupportedHermesSurface('OpenRouter settings');
    }
}
