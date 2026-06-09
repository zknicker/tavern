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
        const created = await this.#http.postJson('/api/cron/jobs', {
            deliver: toHermesCronDeliver(input.delivery ?? null),
            name: input.name,
            prompt: toHermesCronPrompt(input),
            schedule: toHermesCronSchedule(input.schedule),
        });
        const job = mapHermesCronJob(created, input);

        if (input.enabled === false) {
            const paused = await this.#http.postJson(
                `/api/cron/jobs/${encodeURIComponent(job.id)}/pause`,
                {}
            );
            return mapHermesCronJob(paused, input);
        }

        return job;
    }

    async updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron> {
        const updates = toHermesCronUpdates(input);
        let updated: unknown =
            Object.keys(updates).length > 0
                ? await this.#http.putJson(`/api/cron/jobs/${encodeURIComponent(jobId)}`, {
                      updates,
                  })
                : await this.#http.get(`/api/cron/jobs/${encodeURIComponent(jobId)}`);

        if (input.enabled === false) {
            updated = await this.#http.postJson(
                `/api/cron/jobs/${encodeURIComponent(jobId)}/pause`,
                {}
            );
        } else if (input.enabled === true) {
            updated = await this.#http.postJson(
                `/api/cron/jobs/${encodeURIComponent(jobId)}/resume`,
                {}
            );
        }

        return mapHermesCronJob(updated, input);
    }

    async deleteCronJob(jobId: string) {
        await this.#http.deleteJson(`/api/cron/jobs/${encodeURIComponent(jobId)}`);
        return { archived: true as const, id: jobId };
    }

    async getCronJob(jobId: string): Promise<AgentRuntimeCron> {
        const job = await this.#http.get(`/api/cron/jobs/${encodeURIComponent(jobId)}`);
        return mapHermesCronJob(job);
    }

    async listCronJobs() {
        const jobs = readArray(await this.#http.get('/api/cron/jobs'), ['jobs', 'data']);
        return agentRuntimeCronListSchema.parse({
            jobs: jobs.map((job) => {
                const mapped = mapHermesCronJob(job);
                return {
                    agentId: mapped.agentId,
                    description: mapped.description,
                    enabled: mapped.enabled,
                    id: mapped.id,
                    name: mapped.name,
                    schedule: mapped.schedule,
                    state: mapped.state,
                    updatedAt: mapped.updatedAt,
                };
            }),
        });
    }

    async runCronJob(jobId: string, input?: AgentRuntimeRunCron): Promise<AgentRuntimeCronRun> {
        const startedAt = new Date().toISOString();
        await this.#http.postJson(`/api/cron/jobs/${encodeURIComponent(jobId)}/trigger`, {});
        const job = await this.getCronJob(jobId);

        return agentRuntimeCronRunSchema.parse({
            deliveryError: null,
            deliveryStatus: job.delivery ? 'pending' : 'not_applicable',
            executionErrorCode: null,
            executionErrorMessage: null,
            finishedAt: null,
            id: `trigger_${sanitizeCronRunId(jobId)}_${Date.now()}`,
            jobId,
            scheduledFor: startedAt,
            sessionId: null,
            sessionKey: null,
            startedAt,
            status: input?.mode === 'enqueue' ? 'queued' : 'running',
            summary: `Hermes queued ${input?.mode ?? 'force'} cron run.`,
            trigger: 'manual',
        });
    }

    async listCronRuns(jobId?: string) {
        if (!jobId) {
            return { runs: [] };
        }

        const response = await this.#http.get(
            `/api/cron/jobs/${encodeURIComponent(jobId)}/runs?limit=100`
        );
        const runs = readArray(response, ['runs', 'data']).map((run) =>
            mapHermesCronRun(jobId, run)
        );
        return {
            runs,
        };
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

function toHermesCronPrompt(input: Pick<AgentRuntimeCreateCron, 'payload'>) {
    if (input.payload.kind === 'agentTurn') {
        return input.payload.message;
    }
    if (input.payload.kind === 'systemEvent') {
        return input.payload.text;
    }
    throw unsupportedHermesSurface('Hermes cron payload');
}

function toHermesCronSchedule(schedule: AgentRuntimeCron['schedule']) {
    if (schedule.kind === 'at') {
        return schedule.at;
    }
    if (schedule.kind === 'cron') {
        return schedule.expr;
    }

    const minutes = Math.max(1, Math.round(schedule.everyMs / 60_000));
    return `every ${minutes}m`;
}

function toHermesCronDeliver(delivery: AgentRuntimeCron['delivery']) {
    return delivery ? `tavern:${delivery.chatId}` : 'local';
}

type CronFallback = Partial<AgentRuntimeCreateCron> & Partial<AgentRuntimeUpdateCron>;

function toHermesCronUpdates(input: AgentRuntimeUpdateCron) {
    return {
        ...(input.delivery !== undefined ? { deliver: toHermesCronDeliver(input.delivery) } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.payload ? { prompt: toHermesCronPrompt({ payload: input.payload }) } : {}),
        ...(input.schedule ? { schedule: toHermesCronSchedule(input.schedule) } : {}),
    };
}

function mapHermesCronJob(value: unknown, fallback: CronFallback = {}): AgentRuntimeCron {
    const record = asRecord(value);
    const now = new Date().toISOString();
    const id = readString(record, ['id']) ?? readString(record, ['name']) ?? 'hermes-cron-job';
    const prompt = readString(record, ['prompt']) ?? fallbackPrompt(fallback) ?? '';
    const schedule = mapHermesCronSchedule(record.schedule, fallback.schedule);
    const lastRunAtMs = isoMs(readString(record, ['last_run_at']));
    const nextRunAtMs = isoMs(readString(record, ['next_run_at']));
    const lastError = readString(record, ['last_error']);
    const lastDeliveryError = readString(record, ['last_delivery_error']);
    const enabled =
        readBooleanValue(record.enabled, true) && readString(record, ['state']) !== 'paused';

    return agentRuntimeCronSchema.parse({
        agentId: fallback.agentId ?? defaultHermesAgentId,
        createdAt: readIso(record, ['created_at']) ?? now,
        deleteAfterRun: readRepeatTimes(record.repeat) === 1,
        delivery:
            mapHermesCronDelivery(readString(record, ['deliver']) ?? null) ??
            fallback.delivery ??
            null,
        description: fallback.description ?? null,
        enabled,
        id,
        name: readString(record, ['name']) ?? fallback.name ?? id,
        payload:
            fallback.payload ??
            ({
                kind: 'agentTurn',
                message: prompt || readString(record, ['name']) || id,
            } as const),
        schedule,
        state: {
            ...(lastDeliveryError
                ? { lastDeliveryError, lastDeliveryStatus: 'failed' as const }
                : {}),
            ...(lastError
                ? { lastErrorCode: 'execution_failed' as const, lastErrorMessage: lastError }
                : {}),
            ...(lastRunAtMs ? { lastRunAtMs } : {}),
            ...(readString(record, ['last_status'])
                ? {
                      lastRunStatus: mapHermesCronStatus(readString(record, ['last_status'])),
                      lastStatus: mapHermesCronStatus(readString(record, ['last_status'])),
                  }
                : {}),
            ...(nextRunAtMs ? { nextRunAtMs } : {}),
        },
        updatedAt:
            readIso(record, ['updated_at']) ??
            readIso(record, ['created_at']) ??
            readIso(record, ['next_run_at']) ??
            now,
        wakeMode: fallback.wakeMode ?? 'now',
    });
}

function mapHermesCronRun(jobId: string, value: unknown): AgentRuntimeCronRun {
    const record = asRecord(value);
    const sessionId = readString(record, ['id', 'session_id']) ?? `cron_${jobId}`;
    const startedAt = unixOrIsoToIso(record.started_at) ?? unixOrIsoToIso(record.last_active);
    const finishedAt = unixOrIsoToIso(record.ended_at);
    const active = finishedAt === null;

    return agentRuntimeCronRunSchema.parse({
        deliveryError: null,
        deliveryStatus: 'delivered',
        executionErrorCode: null,
        executionErrorMessage: null,
        finishedAt,
        id: sessionId,
        jobId,
        scheduledFor: startedAt ?? new Date().toISOString(),
        sessionId,
        sessionKey: sessionId,
        startedAt,
        status: active ? 'running' : 'success',
        summary: readString(record, ['preview', 'title']) ?? null,
        trigger: 'schedule',
    });
}

function mapHermesCronDelivery(deliver: string | null) {
    if (!deliver || deliver === 'local') {
        return null;
    }
    if (deliver.startsWith('tavern:')) {
        const chatId = deliver.slice('tavern:'.length).trim();
        return chatId ? { chatId } : null;
    }
    return null;
}

function mapHermesCronSchedule(
    value: unknown,
    fallback?: AgentRuntimeCron['schedule']
): AgentRuntimeCron['schedule'] {
    const record = asRecord(value);
    const kind = readString(record, ['kind']);
    if (kind === 'interval') {
        const minutes = readNumberValue(record.minutes) ?? 1;
        return { everyMs: Math.max(1, minutes) * 60_000, kind: 'every' };
    }
    if (kind === 'once') {
        return { at: readString(record, ['run_at']) ?? new Date().toISOString(), kind: 'at' };
    }
    if (kind === 'cron') {
        return { expr: readString(record, ['expr']) ?? '* * * * *', kind: 'cron' };
    }
    if (fallback) {
        return fallback;
    }
    const scheduleText = typeof value === 'string' ? value.trim() : '';
    return scheduleText ? { expr: scheduleText, kind: 'cron' } : { everyMs: 60_000, kind: 'every' };
}

function fallbackPrompt(fallback: CronFallback) {
    return fallback.payload ? toHermesCronPrompt({ payload: fallback.payload }) : null;
}

function readRepeatTimes(value: unknown) {
    const repeat = asRecord(value);
    return readNumberValue(repeat.times);
}

function readBooleanValue(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
}

function readNumberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readIso(record: Record<string, unknown>, keys: string[]) {
    const value = readString(record, keys);
    return value && Number.isFinite(Date.parse(value))
        ? new Date(Date.parse(value)).toISOString()
        : null;
}

function isoMs(value: string | null) {
    if (!value) {
        return null;
    }
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function unixOrIsoToIso(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value * 1000).toISOString();
    }
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
        return new Date(Date.parse(value)).toISOString();
    }
    return null;
}

function mapHermesCronStatus(value: string | null) {
    if (value === 'failed' || value === 'error') {
        return 'error';
    }
    if (value === 'running') {
        return 'running';
    }
    if (value === 'skipped') {
        return 'skipped';
    }
    if (value === 'queued') {
        return 'queued';
    }
    return 'success';
}

function sanitizeCronRunId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, '_');
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
