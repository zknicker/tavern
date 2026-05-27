import type {
    AgentRuntimeAgent,
    AgentRuntimeAgentFileContent,
    AgentRuntimeAgentFileList,
    AgentRuntimeApplyOpenClawConfig,
    AgentRuntimeArchiveAgent,
    AgentRuntimeArchiveBinding,
    AgentRuntimeArchiveCron,
    AgentRuntimeArchiveSkill,
    AgentRuntimeBinding,
    AgentRuntimeChat,
    AgentRuntimeCreateAgent,
    AgentRuntimeCreateCron,
    AgentRuntimeCreateMessage,
    AgentRuntimeCron,
    AgentRuntimeCronList,
    AgentRuntimeCronRun,
    AgentRuntimeInstallSkill,
    AgentRuntimeMemorySettings,
    AgentRuntimeMemoryStatus,
    AgentRuntimeMessageAccepted,
    AgentRuntimeModelAccess,
    AgentRuntimeModelAccessStatus,
    AgentRuntimeModels,
    AgentRuntimeOpenClawConfigSnapshot,
    AgentRuntimeOpenRouterSettings,
    AgentRuntimeRunCron,
    AgentRuntimeSaveClaudeCredential,
    AgentRuntimeSaveCodexCredential,
    AgentRuntimeSaveModels,
    AgentRuntimeSaveOpenRouterSettings,
    AgentRuntimeSessionGraph,
    AgentRuntimeSessionList,
    AgentRuntimeSessionMessageList,
    AgentRuntimeSessionPreviewList,
    AgentRuntimeSessionPrompt,
    AgentRuntimeSessionResync,
    AgentRuntimeSkill,
    AgentRuntimeSkillSummary,
    AgentRuntimeStatus,
    AgentRuntimeUpdateCron,
    AgentRuntimeUpsertBinding,
} from '@tavern/api';
import { createOpenClawGatewayClient } from '../gateway/client.ts';
import { OpenClawGatewayError, OpenClawUnsupportedError } from '../gateway/errors.ts';
import {
    asRecord,
    readBoolean,
    readNumber,
    readRecordArray,
    readString,
    readText,
} from '../gateway/records.ts';
import type { OpenClawGatewayClient, OpenClawGatewayOptions } from '../gateway/types.ts';
import { mapOpenClawDeletedAgent } from '../mappers/agents/delete.ts';
import {
    mapOpenClawAgentFileContent,
    mapOpenClawAgentFileList,
    mapTavernAgentFileToOpenClaw,
    toOpenClawFileName,
} from '../mappers/agents/files.ts';
import { mapOpenClawAgentConfig } from '../mappers/agents/get.ts';
import { mapOpenClawAgentList } from '../mappers/agents/list.ts';
import { mapTavernAgentToOpenClawUpsert } from '../mappers/agents/upsert.ts';
import {
    mapOpenClawBindingList,
    mapOpenClawDeletedBinding,
    mapTavernBindingToOpenClawBinding,
} from '../mappers/chats/bindings.ts';
import { mapOpenClawChatsFromSessions } from '../mappers/chats/list.ts';
import {
    mapOpenClawMessageAccepted,
    mapTavernMessageToOpenClawChatSend,
} from '../mappers/chats/send-message.ts';
import { mapTavernCronCreateToOpenClaw } from '../mappers/cron/create.ts';
import { mapOpenClawDeletedCron } from '../mappers/cron/delete.ts';
import { mapOpenClawCron } from '../mappers/cron/get.ts';
import { mapOpenClawCronList } from '../mappers/cron/list.ts';
import { mapOpenClawCronRun } from '../mappers/cron/run.ts';
import { mapOpenClawCronRuns } from '../mappers/cron/runs.ts';
import { mapTavernCronUpdateToOpenClaw } from '../mappers/cron/update.ts';
import { mapOpenClawModels } from '../mappers/models/list.ts';
import { mapOpenClawSessionGraph } from '../mappers/sessions/graph.ts';
import { mapOpenClawSessionList } from '../mappers/sessions/list.ts';
import { mapOpenClawSessionMessages } from '../mappers/sessions/messages.ts';
import { mapOpenClawSessionPreviews } from '../mappers/sessions/preview.ts';
import { mapOpenClawSessionPrompt } from '../mappers/sessions/prompt.ts';
import { mapOpenClawSessionResync } from '../mappers/sessions/resync.ts';
import { mapOpenClawSkill } from '../mappers/skills/get.ts';
import { mapTavernSkillInstallToOpenClaw } from '../mappers/skills/install.ts';
import { mapOpenClawSkillList } from '../mappers/skills/list.ts';
import { mapOpenClawStatus } from '../mappers/status/get.ts';
import { unsupportedOpenClawSurface } from './unsupported.ts';

export interface OpenClawAgentRuntimeClientOptions extends OpenClawGatewayOptions {
    gateway?: OpenClawGatewayClient;
}

export interface OpenClawAgentRuntimeClient {
    applyOpenClawConfig(
        input: AgentRuntimeApplyOpenClawConfig
    ): Promise<AgentRuntimeOpenClawConfigSnapshot>;
    close(): void;
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    deleteAgent(agentId: string): Promise<AgentRuntimeArchiveAgent>;
    deleteBinding(bindingId: string): Promise<AgentRuntimeArchiveBinding>;
    deleteCronJob(jobId: string): Promise<AgentRuntimeArchiveCron>;
    deleteOpenRouterSettings(): Promise<AgentRuntimeOpenRouterSettings>;
    deleteSkill(skillId: string): Promise<AgentRuntimeArchiveSkill>;
    getAgentConfig(agentId: string): Promise<AgentRuntimeAgent>;
    getAgentFile(agentId: string, path: string): Promise<AgentRuntimeAgentFileContent>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    getMemorySettings(): Promise<AgentRuntimeMemorySettings>;
    getMemoryStatus(): Promise<AgentRuntimeMemoryStatus>;
    getModelAccess(): Promise<AgentRuntimeModelAccess>;
    getModels(): Promise<AgentRuntimeModels>;
    getOpenClawConfig(): Promise<AgentRuntimeOpenClawConfigSnapshot>;
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
    listCronJobs(): Promise<AgentRuntimeCronList>;
    listCronRuns(jobId?: string): Promise<{ runs: AgentRuntimeCronRun[] }>;
    listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ): Promise<AgentRuntimeSessionMessageList>;
    listSessionPreviews(
        input: AgentRuntimeListSessionPreviewsInput
    ): Promise<AgentRuntimeSessionPreviewList>;
    listSessions(): Promise<AgentRuntimeSessionList>;
    listSkills(options?: { agentId?: string }): Promise<{ skills: AgentRuntimeSkillSummary[] }>;
    postMessage(
        chatId: string,
        input: AgentRuntimeCreateMessage
    ): Promise<AgentRuntimeMessageAccepted>;
    resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync>;
    runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun>;
    saveAgentFile(
        agentId: string,
        path: string,
        input: { content: string }
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
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
    upsertAgent(input: AgentRuntimeCreateAgent): Promise<AgentRuntimeAgent>;
    upsertBinding(input: AgentRuntimeUpsertBinding): Promise<AgentRuntimeBinding>;
}

interface AgentRuntimeListSessionMessagesOptions {
    limit?: number;
}

interface AgentRuntimeListSessionPreviewsInput {
    keys: string[];
    limit?: number;
    maxChars?: number;
}

export function createOpenClawAgentRuntimeClient(
    options: OpenClawAgentRuntimeClientOptions
): OpenClawAgentRuntimeClient {
    return new GatewayBackedOpenClawAgentRuntimeClient(
        options.gateway ?? createOpenClawGatewayClient(options)
    );
}

function findOpenClawSkillStatusRecord(
    response: unknown,
    skillId: string
): Record<string, unknown> | null {
    const skills = readRecordArray(asRecord(response), ['skills', 'items', 'entries']);

    return (
        skills.find((skill) => {
            const id = readString(skill, ['id', 'slug', 'name']);
            return id === skillId;
        }) ?? null
    );
}

class GatewayBackedOpenClawAgentRuntimeClient implements OpenClawAgentRuntimeClient {
    readonly #gateway: OpenClawGatewayClient;

    constructor(gateway: OpenClawGatewayClient) {
        this.#gateway = gateway;
    }

    close() {
        this.#gateway.close();
    }

    async getStatus() {
        const [health, status] = await Promise.all([
            this.#gateway.request('health'),
            this.#gateway.request('status'),
        ]);
        return mapOpenClawStatus({ health, status });
    }

    async listAgents() {
        return mapOpenClawAgentList(await this.#gateway.request('agents.list'));
    }

    async getAgentConfig(agentId: string) {
        return await mapAgentConfig(this.#gateway, agentId);
    }

    async upsertAgent(input: AgentRuntimeCreateAgent) {
        await this.#gateway.request('agents.create', mapTavernAgentToOpenClawUpsert(input));
        return await this.getAgentConfig(input.id);
    }

    async listAgentFiles(agentId: string) {
        return mapOpenClawAgentFileList(
            await this.#gateway.request('agents.files.list', { agentId })
        );
    }

    async getAgentFile(agentId: string, path: string) {
        return mapOpenClawAgentFileContent({
            content: await this.#gateway.request('agents.files.get', {
                agentId,
                name: toOpenClawFileName(path),
            }),
            path,
        });
    }

    async saveAgentFile(agentId: string, path: string, input: { content: string }) {
        const file = mapTavernAgentFileToOpenClaw({
            content: input.content,
            path,
        });

        return mapOpenClawAgentFileContent({
            content: await this.#gateway.request('agents.files.set', {
                agentId,
                content: file.content,
                name: file.name,
            }),
            path,
        });
    }

    async deleteAgent(agentId: string) {
        await this.#gateway.request('agents.delete', { agentId });
        return mapOpenClawDeletedAgent(agentId);
    }

    async listChats() {
        return mapOpenClawChatsFromSessions(await this.#gateway.request('sessions.list'));
    }

    async postMessage(_chatId: string, input: AgentRuntimeCreateMessage) {
        const payload = mapTavernMessageToOpenClawChatSend(input);
        const accepted = await this.#gateway.request('chat.send', payload);

        return mapOpenClawMessageAccepted(accepted, payload.sessionKey);
    }

    async listSessions() {
        return mapOpenClawSessionList(await this.#gateway.request('sessions.list'));
    }

    async listSessionMessages(
        sessionKey: string,
        options?: AgentRuntimeListSessionMessagesOptions
    ) {
        return mapOpenClawSessionMessages({
            messages: await this.#gateway.request('chat.history', {
                limit: options?.limit ?? 200,
                sessionKey,
            }),
            sessionKey,
        });
    }

    async listSessionPreviews(input: AgentRuntimeListSessionPreviewsInput) {
        return mapOpenClawSessionPreviews(
            await this.#gateway.request('sessions.preview', {
                keys: input.keys,
                limit: input.limit,
                maxChars: input.maxChars,
            })
        );
    }

    async getSessionGraph(sessionKey: string) {
        const [session, messages] = await Promise.all([
            this.#gateway.request('sessions.get', { sessionKey }),
            this.#gateway.request('chat.history', { sessionKey }),
        ]);

        return mapOpenClawSessionGraph({ messages, session, sessionKey });
    }

    async getSessionPrompt(_sessionKey: string) {
        return mapOpenClawSessionPrompt();
    }

    async resyncSession(sessionKey: string) {
        return mapOpenClawSessionResync(sessionKey);
    }

    async createCronJob(input: AgentRuntimeCreateCron) {
        return mapOpenClawCron(
            await this.#gateway.request('cron.add', mapTavernCronCreateToOpenClaw(input))
        );
    }

    async updateCronJob(jobId: string, input: AgentRuntimeUpdateCron) {
        return mapOpenClawCron(
            await this.#gateway.request('cron.update', {
                id: jobId,
                ...mapTavernCronUpdateToOpenClaw(input),
            })
        );
    }

    async deleteCronJob(jobId: string) {
        await this.#gateway.request('cron.remove', { id: jobId });
        return mapOpenClawDeletedCron(jobId);
    }

    async getCronJob(jobId: string) {
        const response = await this.#gateway.request('cron.list');
        const job = readRecordArray(asRecord(response), ['jobs', 'items', 'entries']).find(
            (record) => record.id === jobId || record.jobId === jobId
        );

        if (!job) {
            throw new OpenClawUnsupportedError(`OpenClaw cron job ${jobId} was not found.`);
        }

        return mapOpenClawCron(job);
    }

    async listCronJobs() {
        return mapOpenClawCronList(await this.#gateway.request('cron.list'));
    }

    async runCronJob(jobId: string, input?: AgentRuntimeRunCron) {
        return mapOpenClawCronRun(
            await this.#gateway.request('cron.run', {
                due: input?.mode === 'enqueue',
                id: jobId,
            }),
            jobId
        );
    }

    async listCronRuns(jobId?: string) {
        return mapOpenClawCronRuns(await listCronRunPages(this.#gateway, jobId), jobId);
    }

    async getModels() {
        return mapOpenClawModels(await this.#gateway.request('models.list'));
    }

    async getOpenClawConfig() {
        return await getOpenClawConfigSnapshot(this.#gateway);
    }

    async applyOpenClawConfig(input: AgentRuntimeApplyOpenClawConfig) {
        await this.#gateway.request('config.apply', {
            baseHash: input.baseHash,
            raw: JSON.stringify(input.config),
        });

        return await getOpenClawConfigSnapshot(this.#gateway);
    }

    async saveModels(input: AgentRuntimeSaveModels) {
        const agent = input.agents[0];
        const primaryModel = agent?.primaryModel;

        if (!(agent && primaryModel)) {
            throw new OpenClawUnsupportedError(
                'OpenClaw model saves require one explicit agent model setting.'
            );
        }

        const modelName = agent.openClawModelName;
        const model = `${modelName.provider}/${modelName.model}`;
        const [currentConfig, models] = await Promise.all([
            getOpenClawConfigSnapshot(this.#gateway),
            this.#gateway.request('models.list'),
        ]);

        await this.#gateway.request('config.apply', {
            baseHash: currentConfig.hash,
            raw: JSON.stringify(
                upsertOpenClawAgentConfig(currentConfig.config, {
                    agentId: agent.agentId,
                    harness: modelName.harness,
                    model,
                })
            ),
        });

        return mapOpenClawModels(models);
    }

    async listSkills(options?: { agentId?: string }) {
        return mapOpenClawSkillList(
            await this.#gateway.request(
                'skills.status',
                options?.agentId ? { agentId: options.agentId } : undefined
            )
        );
    }

    async getSkillConfig(skillId: string) {
        const response = await this.#gateway.request('skills.status');
        const skill = findOpenClawSkillStatusRecord(response, skillId);

        if (!skill) {
            throw new OpenClawGatewayError({
                code: 'not_found',
                message: `OpenClaw skill "${skillId}" was not found.`,
                retryable: false,
            });
        }

        const detail = await this.#gateway
            .request('skills.detail', { slug: skillId })
            .catch(() => null);

        return mapOpenClawSkill(detail ?? skill, skillId);
    }

    async installSkill(input: AgentRuntimeInstallSkill) {
        const response = await this.#gateway.request(
            'skills.install',
            mapTavernSkillInstallToOpenClaw(input)
        );
        return mapOpenClawSkill(response, input.spec);
    }

    async deleteSkill(_skillId: string) {
        return unsupportedOpenClawSurface('skill deletion');
    }

    async listBindings() {
        return mapOpenClawBindingList();
    }

    async upsertBinding(input: AgentRuntimeUpsertBinding) {
        return mapTavernBindingToOpenClawBinding(input);
    }

    async deleteBinding(bindingId: string) {
        return mapOpenClawDeletedBinding(bindingId);
    }

    async getMemorySettings() {
        return unsupportedOpenClawSurface('memory settings');
    }

    async saveMemorySettings(_input: Omit<AgentRuntimeMemorySettings, 'updatedAt'>) {
        return unsupportedOpenClawSurface('memory settings');
    }

    async getMemoryStatus() {
        return unsupportedOpenClawSurface('memory status');
    }

    async getModelAccess() {
        return unsupportedOpenClawSurface('model access credentials');
    }

    async saveClaudeCredential(_input: AgentRuntimeSaveClaudeCredential) {
        return unsupportedOpenClawSurface('Claude credential writes');
    }

    async saveCodexCredential(_input: AgentRuntimeSaveCodexCredential) {
        return unsupportedOpenClawSurface('Codex credential writes');
    }

    async getOpenRouterSettings() {
        return unsupportedOpenClawSurface('OpenRouter settings');
    }

    async saveOpenRouterSettings(_input: AgentRuntimeSaveOpenRouterSettings) {
        return unsupportedOpenClawSurface('OpenRouter settings');
    }

    async deleteOpenRouterSettings() {
        return unsupportedOpenClawSurface('OpenRouter settings');
    }
}

async function mapAgentConfig(gateway: OpenClawGatewayClient, agentId: string) {
    return mapOpenClawAgentConfig({
        agentId,
        agents: await gateway.request('agents.list'),
    });
}

async function getOpenClawConfigSnapshot(gateway: OpenClawGatewayClient) {
    return mapOpenClawConfigSnapshot(await gateway.request('config.get'));
}

function mapOpenClawConfigSnapshot(response: unknown): AgentRuntimeOpenClawConfigSnapshot {
    const record = asRecord(response);
    const hash = readString(record, ['hash']);

    if (!hash) {
        throw new OpenClawUnsupportedError(
            'OpenClaw Gateway config.get did not return a config base hash.'
        );
    }

    const raw = readText(record, ['raw']);
    const config = readOpenClawConfigRecord(record, raw);

    return {
        config,
        hash,
        issues: Array.isArray(record.issues) ? record.issues : [],
        raw: raw ?? JSON.stringify(config),
        valid: typeof record.valid === 'boolean' ? record.valid : null,
    };
}

function readOpenClawConfigRecord(
    record: Record<string, unknown>,
    raw: string | null
): Record<string, unknown> {
    const direct = asRecord(record.config);

    if (Object.keys(direct).length > 0) {
        return direct;
    }

    if (raw) {
        try {
            return asRecord(JSON.parse(raw));
        } catch {
            throw new OpenClawUnsupportedError(
                'OpenClaw Gateway config.get returned invalid JSON.'
            );
        }
    }

    return {};
}

function upsertOpenClawAgentConfig(
    config: Record<string, unknown>,
    input: { agentId: string; harness: string; model: string }
) {
    const agents = asRecord(config.agents);
    const list = readRecordArray(agents, ['list']);
    const existing = list.find((agent) => readString(agent, ['id']) === input.agentId);
    const {
        agentRuntime: _legacyAgentRuntime,
        embeddedHarness: _legacyEmbeddedHarness,
        ...existingConfig
    } = existing ?? {};
    const models = asRecord(existingConfig.models);
    const selectedModelConfig = asRecord(models[input.model]);
    const nextAgent = {
        ...existingConfig,
        id: input.agentId,
        model: {
            ...asRecord(existingConfig.model),
            fallbacks: [],
            primary: input.model,
        },
        models: {
            ...models,
            [input.model]: {
                ...selectedModelConfig,
                agentRuntime: {
                    ...asRecord(selectedModelConfig.agentRuntime),
                    id: input.harness,
                },
            },
        },
    };
    const nextList = existing
        ? list.map((agent) => (readString(agent, ['id']) === input.agentId ? nextAgent : agent))
        : [...list, nextAgent];

    return {
        ...config,
        agents: {
            ...agents,
            list: nextList,
        },
    };
}

async function listCronRunPages(gateway: OpenClawGatewayClient, jobId?: string) {
    const runs: Record<string, unknown>[] = [];
    let offset: number | null = null;

    for (let page = 0; page < 100; page++) {
        const response = await gateway.request('cron.runs', {
            ...(jobId ? { id: jobId } : {}),
            ...(offset === null ? {} : { offset }),
        });
        const record = asRecord(response);
        runs.push(...readRecordArray(record, ['runs', 'items', 'entries']));

        if (!readBoolean(record, ['hasMore'])) {
            return { runs };
        }

        offset = readNumber(record, ['nextOffset']);

        if (offset === null) {
            throw new Error('OpenClaw cron.runs returned hasMore without nextOffset.');
        }
    }

    throw new Error('OpenClaw cron.runs pagination exceeded 100 pages.');
}
