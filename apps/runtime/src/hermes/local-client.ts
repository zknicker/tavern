import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeAgentFileContent,
    type AgentRuntimeAgentFileList,
    type AgentRuntimeCreateAgent,
    type AgentRuntimeCreateCron,
    type AgentRuntimeCron,
    type AgentRuntimeCronRun,
    type AgentRuntimeModels,
    type AgentRuntimeRunCron,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionMessageList,
    type AgentRuntimeSessionPreviewList,
    type AgentRuntimeSessionPrompt,
    type AgentRuntimeSessionResync,
    type AgentRuntimeSkillSummary,
    type AgentRuntimeToolset,
    type AgentRuntimeUpdateAgentModel,
    type AgentRuntimeUpdateAgentName,
    type AgentRuntimeUpdateAgentThinkingDefault,
    type AgentRuntimeUpdateCron,
    type AgentRuntimeUpdateSkillEnabled,
    type AgentRuntimeUpdateToolsetEnabled,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentSchema,
    agentRuntimeCronListSchema,
    agentRuntimeCronRunListSchema,
    agentRuntimeCronRunSchema,
    agentRuntimeCronSchema,
    agentRuntimeHermesConfigSnapshotSchema,
    agentRuntimeModelsSchema,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionPreviewListSchema,
    agentRuntimeSessionResyncSchema,
} from '@tavern/api';
import {
    getRuntimePort,
    HERMES_DASHBOARD_SESSION_TOKEN,
    HERMES_HOME,
    HERMES_WORKSPACE,
    readConfigValue,
} from '../config';
import { readHermesAdapterState, updateHermesAdapterState } from './adapter-state';
import { defaultHermesAgentId, defaultHermesHost, defaultHermesPort } from './constants';
import { unsupportedHermesSurface } from './errors';
import { HermesGateway } from './gateway';
import { HermesHttp } from './http';
import {
    asRecord,
    defaultHermesAgent,
    mapHermesMessage,
    mapHermesSession,
    mapHermesSkill,
    mapHermesToolset,
    readArray,
    readString,
    readStringArray,
    truncate,
} from './mappers';
import type { HermesSseEvent, LocalHermesClientOptions } from './protocol';
import {
    deleteHermesSessionMapping,
    getHermesSessionMapping,
    saveHermesSessionMapping,
} from './session-map';
import { LocalHermesUnsupportedSurfaces } from './unsupported-surfaces';

const editableHermesAgentFiles = [
    {
        mediaType: 'text/markdown',
        path: 'AGENTS.md',
        storagePath: path.join(HERMES_WORKSPACE, 'AGENTS.md'),
    },
    {
        mediaType: 'text/markdown',
        path: 'SOUL.md',
        storagePath: path.join(HERMES_HOME, 'SOUL.md'),
    },
] as const;

export function createLocalHermesClient() {
    return new LocalHermesClient({
        baseUrl: readHermesBaseUrl(),
        token: readConfigValue('TAVERN_HERMES_TOKEN') ?? HERMES_DASHBOARD_SESSION_TOKEN,
    });
}

export class LocalHermesClient extends LocalHermesUnsupportedSurfaces {
    readonly #gateway: HermesGateway;
    readonly #http: HermesHttp;

    constructor(options: LocalHermesClientOptions) {
        super();
        this.#gateway = new HermesGateway(options);
        this.#http = new HermesHttp(options);
    }

    async getStatus() {
        await this.#http.get('/api/status').catch(async () => {
            await this.#http.get('/health');
        });
    }

    async assertApiReady() {
        await this.#http.get('/api/sessions');
    }

    async assertGatewayReady() {
        await this.#gateway.connect();
    }

    async listAgents() {
        const state = await readHermesAdapterState();
        return agentRuntimeAgentListSchema.parse({
            agents: [
                {
                    ...defaultHermesAgent(),
                    ...state.agent,
                },
            ],
        });
    }

    async getAgentConfig(agentId: string) {
        if (agentId === defaultHermesAgentId) {
            return (await this.listAgents()).agents[0] ?? defaultHermesAgent();
        }
        throw unsupportedHermesSurface(`Hermes agent "${agentId}"`);
    }

    async upsertAgent(input: AgentRuntimeCreateAgent) {
        const existing = await this.getAgentConfig(defaultHermesAgentId);
        const next = agentRuntimeAgentSchema.parse({
            ...existing,
            avatar: input.avatar ?? existing.avatar,
            enabledSkillIds: input.enabledSkillIds ?? existing.enabledSkillIds,
            emoji: input.emoji ?? existing.emoji,
            isAdmin: input.isAdmin ?? existing.isAdmin,
            name: input.name,
            primaryColor: input.primaryColor ?? existing.primaryColor,
            workspaceFolder: input.workspaceFolder,
        });

        await updateHermesAdapterState((state) => ({
            ...state,
            agent: {
                ...state.agent,
                enabledSkillIds: next.enabledSkillIds,
                name: next.name,
            },
        }));

        return next;
    }

    async listAgentFiles(agentId: string): Promise<AgentRuntimeAgentFileList> {
        await this.getAgentConfig(agentId);
        return {
            files: await Promise.all(
                editableHermesAgentFiles.map(async (file) => {
                    const stats = await readFileStats(file.storagePath);
                    return {
                        mediaType: file.mediaType,
                        path: file.path,
                        sizeBytes: stats?.size ?? 0,
                        updatedAt: stats?.updatedAt ?? null,
                    };
                })
            ),
        };
    }

    async getAgentFile(agentId: string, filePath: string): Promise<AgentRuntimeAgentFileContent> {
        await this.getAgentConfig(agentId);
        const file = resolveEditableHermesAgentFile(filePath);
        const stats = await readFileStats(file.storagePath);
        return {
            content: await fs.readFile(file.storagePath, 'utf8').catch(() => ''),
            mediaType: file.mediaType,
            path: file.path,
            sizeBytes: stats?.size ?? 0,
            updatedAt: stats?.updatedAt ?? null,
        };
    }

    async saveAgentFile(
        agentId: string,
        filePath: string,
        input: { content: string }
    ): Promise<AgentRuntimeAgentFileContent> {
        await this.getAgentConfig(agentId);
        const file = resolveEditableHermesAgentFile(filePath);
        await fs.mkdir(path.dirname(file.storagePath), { recursive: true });
        await fs.writeFile(file.storagePath, input.content, { mode: 0o600 });
        try {
            await fs.chmod(file.storagePath, 0o600);
        } catch {
            // chmod is best-effort on non-POSIX filesystems.
        }
        return await this.getAgentFile(agentId, file.path);
    }

    async updateAgentName(_agentId: string, input: AgentRuntimeUpdateAgentName) {
        await updateHermesAdapterState((state) => ({
            ...state,
            agent: {
                ...state.agent,
                name: input.name,
            },
        }));
        return toHermesConfigSnapshot({
            agent: { name: input.name },
            hash: `agent-name:${input.name}`,
        });
    }

    async updateAgentModel(_agentId: string, input: AgentRuntimeUpdateAgentModel) {
        const result = await this.#http.postJson('/api/model/set', {
            base_url: input.model.baseUrl,
            model: input.model.model,
            provider: input.model.provider,
            scope: 'main',
        });
        await updateHermesAdapterState((state) => ({
            ...state,
            agent: {
                ...state.agent,
                hermesModelName: input.model,
            },
        }));
        return toHermesConfigSnapshot({
            hash: `model:${input.model.provider}/${input.model.model}`,
            model: input.model,
            result,
        });
    }

    async updateAgentThinkingDefault(
        _agentId: string,
        input: AgentRuntimeUpdateAgentThinkingDefault
    ) {
        await updateHermesAdapterState((state) => ({
            ...state,
            agent: {
                ...state.agent,
                thinkingDefault: input.thinkingDefault,
            },
        }));
        return toHermesConfigSnapshot({
            agent: { thinkingDefault: input.thinkingDefault },
            hash: `thinking:${input.thinkingDefault ?? 'default'}`,
        });
    }

    async createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron> {
        if (input.enabled ?? true) {
            throw unsupportedHermesSurface('Hermes scheduled cron execution');
        }

        const now = new Date().toISOString();
        const job = agentRuntimeCronSchema.parse({
            agentId: input.agentId ?? null,
            createdAt: now,
            deleteAfterRun: input.deleteAfterRun ?? false,
            delivery: input.delivery ?? null,
            description: input.description ?? null,
            enabled: input.enabled ?? true,
            id: input.id,
            name: input.name,
            payload: input.payload,
            schedule: input.schedule,
            state: {},
            updatedAt: now,
            wakeMode: input.wakeMode,
        });
        await updateHermesAdapterState((state) => ({
            ...state,
            cronJobs: [...(state.cronJobs ?? []).filter((existing) => existing.id !== job.id), job],
        }));
        return job;
    }

    async updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron> {
        if (input.enabled === true) {
            throw unsupportedHermesSurface('Hermes scheduled cron execution');
        }

        let updated: AgentRuntimeCron | null = null;
        await updateHermesAdapterState((state) => {
            const cronJobs = state.cronJobs ?? [];
            const existing = cronJobs.find((job) => job.id === jobId);
            if (!existing) {
                throw unsupportedHermesSurface(`Hermes cron job "${jobId}"`);
            }
            updated = agentRuntimeCronSchema.parse({
                ...existing,
                ...input,
                state: {
                    ...existing.state,
                    ...(input.state ?? {}),
                },
                updatedAt: new Date().toISOString(),
            });
            return {
                ...state,
                cronJobs: cronJobs.map((job) => (job.id === jobId ? (updated ?? job) : job)),
            };
        });
        return updated ?? unsupportedHermesSurface(`Hermes cron job "${jobId}"`);
    }

    async deleteCronJob(jobId: string) {
        await updateHermesAdapterState((state) => ({
            ...state,
            cronJobs: (state.cronJobs ?? []).filter((job) => job.id !== jobId),
        }));
        return { archived: true as const, id: jobId };
    }

    async getCronJob(jobId: string): Promise<AgentRuntimeCron> {
        const job = (await readHermesAdapterState()).cronJobs?.find(
            (candidate) => candidate.id === jobId
        );
        if (!job) {
            throw unsupportedHermesSurface(`Hermes cron job "${jobId}"`);
        }
        return agentRuntimeCronSchema.parse(job);
    }

    async listCronJobs() {
        const jobs = (await readHermesAdapterState()).cronJobs ?? [];
        return agentRuntimeCronListSchema.parse({
            jobs: jobs.map(
                ({ agentId, description, enabled, id, name, schedule, state, updatedAt }) => ({
                    agentId,
                    description,
                    enabled,
                    id,
                    name,
                    schedule,
                    state,
                    updatedAt,
                })
            ),
        });
    }

    async runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun> {
        const job = await this.getCronJob(jobId);
        const runId = `run_${randomUUID()}`;
        const startedAt = new Date().toISOString();
        const sessionKey = `agent:${job.agentId ?? defaultHermesAgentId}:cron:${jobId}:${runId}`;
        const runBase = {
            id: runId,
            jobId,
            scheduledFor: startedAt,
            startedAt,
            trigger: 'manual',
        } as const;

        let run: AgentRuntimeCronRun;
        try {
            const prompt = buildCronPrompt(job, input);
            let summary: string | null = null;
            for await (const event of this.streamChat({
                content: prompt,
                sessionKey,
                title: job.name,
            })) {
                if (event.event === 'assistant.completed') {
                    summary = truncate(readString(asRecord(event.data), ['content']) ?? '', 500);
                }
                if (event.event === 'error') {
                    throw new Error(
                        readString(asRecord(event.data), ['message']) ?? 'Hermes cron run failed.'
                    );
                }
            }
            const mapping = await getHermesSessionMapping(sessionKey);
            run = agentRuntimeCronRunSchema.parse({
                ...runBase,
                deliveryError: job.delivery
                    ? 'Managed Hermes cron delivery into Tavern chats is not implemented.'
                    : null,
                deliveryStatus: job.delivery ? 'failed' : 'not_applicable',
                executionErrorCode: null,
                executionErrorMessage: null,
                finishedAt: new Date().toISOString(),
                sessionId: mapping?.hermesSessionKey ?? sessionKey,
                sessionKey,
                status: 'success',
                summary: summary || `Hermes completed ${input?.mode ?? 'force'} cron run.`,
            });
        } catch (error) {
            run = agentRuntimeCronRunSchema.parse({
                ...runBase,
                deliveryError: job.delivery ? 'Cron execution failed before delivery.' : null,
                deliveryStatus: job.delivery ? 'failed' : 'not_applicable',
                executionErrorCode: 'execution_failed',
                executionErrorMessage:
                    error instanceof Error ? error.message : 'Hermes cron run failed.',
                finishedAt: new Date().toISOString(),
                sessionId: null,
                sessionKey,
                status: 'error',
                summary: 'Hermes cron run failed.',
            });
        }
        await recordCronRun({ jobId, run });
        return run;
    }

    async listCronRuns(jobId?: string) {
        const runs = (await readHermesAdapterState()).cronRuns ?? [];
        return agentRuntimeCronRunListSchema.parse({
            runs: jobId ? runs.filter((run) => run.jobId === jobId) : runs,
        });
    }

    async listSessions() {
        const response = await this.#http.get('/api/sessions');
        const sessions = readArray(response, ['sessions', 'data']).map(mapHermesSession);
        return agentRuntimeSessionListSchema.parse({ sessions });
    }

    async listSessionMessages(
        sessionKey: string,
        options?: { limit?: number }
    ): Promise<AgentRuntimeSessionMessageList> {
        const hermesSessionKey = await this.#resolveHermesSessionKey(sessionKey);
        const response = await this.#http.get(
            `/api/sessions/${encodeURIComponent(hermesSessionKey)}/messages`
        );
        const messages = readArray(response, ['messages', 'data'])
            .slice(0, options?.limit ?? 200)
            .map((message, index) => mapHermesMessage(sessionKey, message, index));
        return agentRuntimeSessionMessageListSchema.parse({ messages });
    }

    async listSessionPreviews(input: {
        keys: string[];
        limit?: number;
        maxChars?: number;
    }): Promise<AgentRuntimeSessionPreviewList> {
        const previews = await Promise.all(
            input.keys.map(async (key) => {
                try {
                    const messages = await this.listSessionMessages(key, {
                        limit: input.limit ?? 4,
                    });
                    return {
                        items: messages.messages.map((message) => ({
                            role: message.senderType,
                            text: truncate(message.content, input.maxChars ?? 500),
                        })),
                        key,
                        status: messages.messages.length > 0 ? 'ok' : 'empty',
                    };
                } catch {
                    return { items: [], key, status: 'missing' };
                }
            })
        );
        return agentRuntimeSessionPreviewListSchema.parse({
            previews,
            ts: Date.now(),
        });
    }

    async getSessionGraph(sessionKey: string): Promise<AgentRuntimeSessionGraph> {
        const hermesSessionKey = await this.#resolveHermesSessionKey(sessionKey);
        const [sessions, messages] = await Promise.all([
            this.listSessions(),
            this.listSessionMessages(sessionKey),
        ]);
        return agentRuntimeSessionGraphSchema.parse({
            artifacts: [],
            links: [],
            messages: messages.messages,
            rootSessionKey: sessionKey,
            sessions: sessions.sessions
                .filter((session) => session.key === hermesSessionKey)
                .map((session) => ({
                    ...session,
                    chatId: `hermes:${sessionKey}`,
                    key: sessionKey,
                    sessionId: sessionKey,
                })),
            toolCalls: [],
        });
    }

    async getSessionPrompt(_sessionKey: string): Promise<AgentRuntimeSessionPrompt | null> {
        return null;
    }

    async resyncSession(sessionKey: string): Promise<AgentRuntimeSessionResync> {
        return agentRuntimeSessionResyncSchema.parse({
            resynced: true,
            rootSessionKey: sessionKey,
            sessionKey,
        });
    }

    async getModels(): Promise<AgentRuntimeModels> {
        const response = await this.#http.get('/api/model/options');
        const providers = readArray(response, ['providers']);
        const models = providers.flatMap((provider) => {
            const record = provider && typeof provider === 'object' ? provider : {};
            const providerId = readString(record as Record<string, unknown>, ['slug', 'name']);
            return readStringArray((record as Record<string, unknown>).models).map((model) => ({
                id: providerId ? `${providerId}/${model}` : model,
                label: model,
                provider: providerId,
            }));
        });
        return agentRuntimeModelsSchema.parse({
            models,
            updatedAt: new Date().toISOString(),
        });
    }

    async listSkills(_options?: {
        agentId?: string;
    }): Promise<{ skills: AgentRuntimeSkillSummary[] }> {
        const response = await this.#http.get('/api/skills');
        return { skills: readArray(response, ['skills', 'data', 'items']).map(mapHermesSkill) };
    }

    async listToolsets(): Promise<{ toolsets: AgentRuntimeToolset[] }> {
        const response = await this.#http.get('/api/tools/toolsets');
        return {
            toolsets: readArray(response, ['toolsets', 'data', 'items']).map(mapHermesToolset),
        };
    }

    async updateSkillEnabled(skillId: string, input: AgentRuntimeUpdateSkillEnabled) {
        const summary = (await this.listSkills()).skills.find((skill) => skill.id === skillId);
        if (!summary) {
            throw unsupportedHermesSurface(`Hermes skill "${skillId}"`);
        }
        await this.#http.putJson('/api/skills/toggle', {
            enabled: input.enabled,
            name: summary.skillKey ?? summary.name,
        });
        return {
            ...summary,
            contentMarkdown: '',
            disabled: !input.enabled,
            files: [],
            installSource: null,
            userInvocable: input.enabled,
        };
    }

    async updateToolsetEnabled(
        toolsetId: string,
        input: AgentRuntimeUpdateToolsetEnabled
    ): Promise<AgentRuntimeToolset> {
        await this.#http.putJson(`/api/tools/toolsets/${encodeURIComponent(toolsetId)}`, {
            enabled: input.enabled,
        });
        const toolsets = await this.listToolsets();
        const updated = toolsets.toolsets.find((toolset) => toolset.id === toolsetId);
        if (!updated) {
            throw unsupportedHermesSurface(`Hermes toolset "${toolsetId}"`);
        }
        return updated;
    }

    async getHermesConfig() {
        const state = await readHermesAdapterState();
        const agent = {
            ...defaultHermesAgent(),
            ...state.agent,
        };
        const config = {
            agents: {
                list: [
                    {
                        id: agent.id,
                        name: agent.name,
                    },
                ],
            },
        };
        return toInvalidHermesConfigSnapshot({
            config,
            hash: `hermes-adapter:${JSON.stringify(config)}`,
        });
    }

    async *streamChat(input: {
        content: string;
        sessionKey: string;
        title?: string | null;
        signal?: AbortSignal;
    }): AsyncGenerator<HermesSseEvent> {
        const session = await this.#openGatewaySession(input.sessionKey, input.title);
        const liveSessionId = session.liveSessionId;
        if (!liveSessionId) {
            throw new Error('Hermes did not create a live session.');
        }

        const events = this.#gateway.events({
            sessionId: liveSessionId,
            signal: input.signal,
        });
        await this.#gateway.request('prompt.submit', {
            session_id: liveSessionId,
            text: input.content,
        });

        for await (const event of events) {
            if (event.type === 'session.info') {
                yield {
                    data: event.payload,
                    event: 'session.info',
                };
                continue;
            }

            if (event.type === 'message.delta') {
                yield {
                    data: { delta: readString(event.payload, ['text']) ?? '' },
                    event: 'assistant.delta',
                };
                continue;
            }

            if (event.type === 'message.complete') {
                yield {
                    data: {
                        content: readString(event.payload, ['text']) ?? '',
                        message_id: readString(event.payload, ['message_id', 'id']),
                        model: readString(event.payload, ['model']),
                        status: readString(event.payload, ['status']),
                        usage: event.payload.usage ?? null,
                    },
                    event: 'assistant.completed',
                };
                return;
            }

            if (event.type === 'tool.start') {
                yield {
                    data: {
                        arguments: event.payload.args ?? {},
                        preview: readString(event.payload, ['context', 'preview', 'args_text']),
                        tool_call_id: readString(event.payload, ['tool_id', 'id', 'call_id']),
                        tool_name: readString(event.payload, ['name', 'tool_name']) ?? 'tool',
                    },
                    event: 'tool.started',
                };
                continue;
            }

            if (event.type === 'tool.progress' || event.type === 'tool.generating') {
                yield {
                    data: {
                        delta: readString(event.payload, ['preview', 'text', 'context']) ?? '',
                        source_event: event.type,
                        tool_call_id: readString(event.payload, ['tool_id', 'id', 'call_id']),
                        tool_name: readString(event.payload, ['name', 'tool_name']) ?? 'tool',
                    },
                    event: 'tool.progress',
                };
                continue;
            }

            if (event.type === 'tool.complete') {
                yield {
                    data: {
                        arguments: event.payload.args ?? {},
                        preview: readString(event.payload, ['summary', 'result_text', 'preview']),
                        result: event.payload.result_text ?? event.payload.result ?? null,
                        tool_call_id: readString(event.payload, ['tool_id', 'id', 'call_id']),
                        tool_name: readString(event.payload, ['name', 'tool_name']) ?? 'tool',
                    },
                    event: 'tool.completed',
                };
                continue;
            }

            if (event.type === 'reasoning.delta') {
                yield {
                    data: {
                        delta: readString(event.payload, ['text']) ?? '',
                    },
                    event: 'reasoning.delta',
                };
                continue;
            }

            if (event.type === 'status.update') {
                yield {
                    data: {
                        delta: readString(event.payload, ['text']) ?? '',
                        kind: readString(event.payload, ['kind']) ?? 'status',
                        source_event: event.type,
                    },
                    event: 'assistant.status',
                };
                continue;
            }

            if (event.type === 'error') {
                yield {
                    data: {
                        message: readString(event.payload, ['message']) ?? 'Hermes stream failed.',
                    },
                    event: 'error',
                };
                return;
            }
        }
    }

    override close() {
        this.#gateway.close();
    }

    async #openGatewaySession(sessionKey: string, title?: string | null) {
        const mapped = await getHermesSessionMapping(sessionKey);
        if (mapped) {
            try {
                const resumed = await this.#gateway.request<{
                    resumed?: string;
                    session_id?: string;
                    session_key?: string;
                    stored_session_id?: string;
                }>('session.resume', {
                    session_id: mapped.hermesSessionKey,
                });
                const liveSessionId = readString(resumed, ['session_id']);
                if (!liveSessionId) {
                    throw new Error('Hermes did not resume a live session.');
                }
                return {
                    hermesSessionKey:
                        readString(resumed, ['resumed', 'session_key', 'stored_session_id']) ??
                        mapped.hermesSessionKey,
                    liveSessionId,
                };
            } catch (error) {
                await deleteHermesSessionMapping(sessionKey);
                if (!isMissingHermesSession(error)) {
                    throw error;
                }
            }
        }

        const created = await this.#gateway.request<{
            session_id?: string;
            session_key?: string;
            stored_session_id?: string;
        }>('session.create', {
            title: title ?? sessionKey,
        });
        const liveSessionId = readString(created, ['session_id']);
        const hermesSessionKey =
            readString(created, ['stored_session_id', 'session_key']) ?? liveSessionId;
        if (!(liveSessionId && hermesSessionKey)) {
            throw new Error('Hermes did not create a live session.');
        }
        await saveHermesSessionMapping({
            hermesSessionKey,
            tavernSessionKey: sessionKey,
        });
        return { hermesSessionKey, liveSessionId };
    }

    async #resolveHermesSessionKey(sessionKey: string) {
        return (await getHermesSessionMapping(sessionKey))?.hermesSessionKey ?? sessionKey;
    }
}

function toHermesConfigSnapshot(input: {
    agent?: Record<string, unknown>;
    hash: string;
    model?: AgentRuntimeUpdateAgentModel['model'];
    result?: unknown;
}) {
    const baseUrl = asRecord(input.result).base_url;
    const config = {
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.model
            ? {
                  model: {
                      ...(typeof baseUrl === 'string' && baseUrl ? { base_url: baseUrl } : {}),
                      default: input.model.model,
                      harness: input.model.harness,
                      provider: input.model.provider,
                  },
              }
            : {}),
    };
    return agentRuntimeHermesConfigSnapshotSchema.parse({
        config,
        hash: input.hash,
        issues: [],
        raw: JSON.stringify({ config, result: input.result ?? null }),
        valid: true,
    });
}

function toInvalidHermesConfigSnapshot(input: { config: Record<string, unknown>; hash: string }) {
    return agentRuntimeHermesConfigSnapshotSchema.parse({
        config: input.config,
        hash: input.hash,
        issues: ['Managed Hermes does not expose raw config mutation through Tavern.'],
        raw: null,
        valid: false,
    });
}

async function recordCronRun(input: { jobId: string; run: AgentRuntimeCronRun }) {
    const finishedAtMs = input.run.finishedAt ? Date.parse(input.run.finishedAt) : Date.now();
    const startedAtMs = input.run.startedAt ? Date.parse(input.run.startedAt) : finishedAtMs;
    const durationMs = Number.isFinite(finishedAtMs - startedAtMs)
        ? Math.max(0, finishedAtMs - startedAtMs)
        : undefined;

    await updateHermesAdapterState((state) => ({
        ...state,
        cronJobs: (state.cronJobs ?? []).map((candidate) =>
            candidate.id === input.jobId
                ? {
                      ...candidate,
                      state: {
                          ...candidate.state,
                          ...(durationMs === undefined ? {} : { lastDurationMs: durationMs }),
                          ...(input.run.deliveryError
                              ? { lastDeliveryError: input.run.deliveryError }
                              : {}),
                          ...(input.run.deliveryStatus
                              ? { lastDeliveryStatus: input.run.deliveryStatus }
                              : {}),
                          ...(input.run.executionErrorCode
                              ? { lastErrorCode: input.run.executionErrorCode }
                              : {}),
                          ...(input.run.executionErrorMessage
                              ? { lastErrorMessage: input.run.executionErrorMessage }
                              : {}),
                          lastRunAtMs: finishedAtMs,
                          lastRunStatus: input.run.status,
                          lastStatus: input.run.status,
                      },
                      updatedAt: input.run.finishedAt ?? new Date().toISOString(),
                  }
                : candidate
        ),
        cronRuns: [input.run, ...(state.cronRuns ?? [])],
    }));
}

function buildCronPrompt(job: AgentRuntimeCron, input?: AgentRuntimeRunCron) {
    if (job.payload.kind === 'agentTurn') {
        return job.payload.message;
    }

    if (job.payload.kind === 'systemEvent') {
        return job.payload.text;
    }

    throw unsupportedHermesSurface(`Hermes cron payload for ${input?.mode ?? 'force'} run`);
}

function readHermesBaseUrl() {
    const host = readConfigValue('TAVERN_HERMES_HOST') ?? defaultHermesHost;
    const port = readConfigValue('TAVERN_HERMES_PORT') ?? defaultHermesPort;
    return `http://${host}:${port}`;
}

function resolveEditableHermesAgentFile(filePath: string) {
    const file = editableHermesAgentFiles.find((candidate) => candidate.path === filePath);
    if (!file) {
        throw unsupportedHermesSurface(`Hermes agent file "${filePath}"`);
    }
    return file;
}

async function readFileStats(filePath: string) {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
        };
    } catch {
        return null;
    }
}

function isMissingHermesSession(error: unknown) {
    return error instanceof Error && /session not found/iu.test(error.message);
}

export function buildRuntimeApiBaseUrl() {
    return `http://127.0.0.1:${getRuntimePort()}`;
}
