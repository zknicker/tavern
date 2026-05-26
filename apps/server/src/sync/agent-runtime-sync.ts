import { setTimeout as delay } from 'node:timers/promises';
import type {
    AgentRuntimeAgent,
    AgentRuntimeCron,
    AgentRuntimeCronRun,
    AgentRuntimeSession,
} from '@tavern/api';
import { hasActiveTurnSession } from '../agent-runtime/active-turn-sessions.ts';
import {
    recordCapabilityFailure,
    recordCapabilitySuccess,
    withCapabilityStatus,
} from '../agent-runtime/capability-status.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import {
    emitAgentUpdated,
    emitChatLogUpdated,
    emitChatUpdated,
    emitCronUpdated,
    emitSessionUpdated,
    emitSkillUpdated,
} from '../api/invalidation-events.ts';
import { syncChatParticipantsForRuntime } from '../participants/chat-participants.ts';
import { listAgentProfiles } from '../storage/agent-profiles.ts';
import {
    listReachableAgentRuntimeConnections,
    markAgentRuntimeConnectionSync,
} from '../storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../storage/agents.ts';
import { buildCronJobId, syncCronJobsForRuntime } from '../storage/cron-jobs.ts';
import { upsertCronRuns } from '../storage/cron-runs.ts';
import {
    getSessionMessageState,
    syncSessionMessagesForRuntime,
} from '../storage/session-messages.ts';
import { syncSessionToolCallsForRuntime } from '../storage/session-tool-call-sync.ts';
import { syncSessionsForRuntime } from '../storage/sessions.ts';
import type { SyncPrimitiveKind } from './contracts.ts';
import { savePrimitiveSyncState } from './primitive-sync-state.ts';

type SyncLog = (message: string) => Promise<void>;
type RuntimeConnectionRecord = Awaited<
    ReturnType<typeof listReachableAgentRuntimeConnections>
>[number];

interface SyncInput {
    log?: SyncLog;
}

interface RuntimeSyncInput extends SyncInput {
    runtime: RuntimeConnectionRecord;
}

const recentSessionMessageLimit = 200;
const deepSessionMessageLimit = 1000;
const deepSessionMessageSyncAfterMs = 6 * 60 * 60 * 1000;
const defaultSessionMessageRetryDelaysMs = [250, 750, 1500, 3000];

export async function syncAgentRuntimeAgents(input?: SyncInput) {
    return await syncPrimitiveAcrossRuntimes('agent', input, syncAgentsForConnection);
}

export async function syncAgentRuntimeChats(input?: SyncInput) {
    return await syncPrimitiveAcrossRuntimes('chat', input, syncChatsForConnection);
}

export async function syncAgentRuntimeSessions(input?: SyncInput) {
    return await syncPrimitiveAcrossRuntimes('session', input, syncSessionsForConnection);
}

export async function syncAgentRuntimeSession(input: {
    client: Pick<TavernAgentRuntimeClient, 'listSessions'>;
    log?: SyncLog;
    runtimeId: string;
    sessionKey: string;
    syncedAt?: string;
}) {
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const sessions = (
        await withCapabilityStatus(
            {
                capability: 'sessions',
                method: 'sessions.list',
                runtimeId: input.runtimeId,
            },
            async () => await input.client.listSessions()
        )
    ).sessions;
    const session = sessions.find((candidate) => candidate.key === input.sessionKey);

    if (!session) {
        await input.log?.(`Session ${input.sessionKey} was not present in the runtime index.`);
        return { synced: 0 };
    }

    const result = await syncSessionsForRuntime({
        runtimeId: input.runtimeId,
        sessions: [session],
        syncedAt,
    });

    await input.log?.(`Synced session ${input.sessionKey}.`);
    emitSessionUpdatedIfChanged(result, input.sessionKey);

    return result;
}

export async function syncAgentRuntimeSessionMessages(input: {
    client: Pick<TavernAgentRuntimeClient, 'listSessionMessages'>;
    agentId?: null | string;
    log?: SyncLog;
    runtimeId: string;
    sessionKey: string;
    syncedAt?: string;
}) {
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const messageState = await getSessionMessageState(input.sessionKey);
    const limit = resolveSessionMessageSyncLimit({
        now: syncedAt,
        messageState,
    });
    const response = await withCapabilityStatus(
        {
            capability: 'messages',
            method: 'chat.history',
            runtimeId: input.runtimeId,
        },
        async () => await input.client.listSessionMessages(input.sessionKey, { limit })
    );
    const messages = response.messages.map((message) => ({
        ...message,
        agentId:
            message.senderType === 'agent'
                ? (message.agentId ?? input.agentId ?? null)
                : message.agentId,
    }));
    const result = await syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map([[input.sessionKey, messages]]),
        runtimeId: input.runtimeId,
        syncedAt,
    });

    await input.log?.(`Synced ${result.synced} messages for session ${input.sessionKey}.`);
    emitSessionDetailUpdatedIfChanged(result, input.sessionKey);

    return { ...result, messages };
}

export async function syncAgentRuntimeSessionMessagesWithRetry(input: {
    agentId?: null | string;
    client: Pick<TavernAgentRuntimeClient, 'listSessionMessages'>;
    log?: SyncLog;
    retryDelaysMs?: number[];
    runtimeId: string;
    sessionKey: string;
    syncedAt?: string;
}) {
    const retryDelaysMs = input.retryDelaysMs ?? defaultSessionMessageRetryDelaysMs;
    let lastResult: Awaited<ReturnType<typeof syncAgentRuntimeSessionMessages>> = {
        deleted: 0,
        messages: [],
        synced: 0,
    };

    for (const waitMs of [0, ...retryDelaysMs]) {
        if (waitMs > 0) {
            await delay(waitMs);
        }

        lastResult = await syncAgentRuntimeSessionMessages(input);

        if (lastResult.synced > 0) {
            return lastResult;
        }
    }

    return lastResult;
}

export async function syncAgentRuntimeCron(input?: SyncInput) {
    return await syncPrimitiveAcrossRuntimes('cron', input, syncCronForConnection);
}

async function syncPrimitiveAcrossRuntimes(
    kind: SyncPrimitiveKind,
    input: SyncInput | undefined,
    syncRuntime: (input: RuntimeSyncInput) => Promise<{ deleted?: number; synced: number }>
) {
    const runtimes = await listReachableAgentRuntimeConnections();
    const results: Array<{
        deleted: number;
        runtimeId: string;
        runtimeName: string;
        synced: number;
    }> = [];

    if (runtimes.length === 0) {
        await input?.log?.('No reachable Tavern Runtime connection is available.');
        return results;
    }

    for (const runtime of runtimes) {
        const attemptedAt = new Date().toISOString();

        try {
            const result = await syncRuntime({
                log: input?.log,
                runtime,
            });

            await savePrimitiveSyncState({
                attemptedAt,
                agentRuntimeConfig: result,
                error: null,
                id: runtime.id,
                kind,
                localConfig: result,
                status: 'inSync',
                successful: true,
            });
            await markAgentRuntimeConnectionSync({
                id: runtime.id,
                lastError: null,
                lastSyncedAt: attemptedAt,
            });
            results.push({
                deleted: result.deleted ?? 0,
                runtimeId: runtime.id,
                runtimeName: runtime.name,
                synced: result.synced,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            await savePrimitiveSyncState({
                attemptedAt,
                agentRuntimeConfig: null,
                error: message,
                id: runtime.id,
                kind,
                localConfig: { failed: true },
                status: 'error',
                successful: false,
            });
            await input?.log?.(`Failed to sync ${kind} from ${runtime.name}: ${message}`);
            throw error;
        }
    }

    if (results.some(hasChanged)) {
        emitForPrimitive(kind);
    }

    return results;
}

async function syncAgentsForConnection(input: RuntimeSyncInput) {
    const client = createAgentRuntimeClientForConnection(input.runtime);
    const syncedAt = new Date().toISOString();
    const agents = (
        await withCapabilityStatus(
            {
                capability: 'agents',
                method: 'agents.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listAgents()
        )
    ).agents;
    const result = await syncAgentsForRuntime({
        agents,
        runtimeId: input.runtime.id,
        syncedAt,
    });
    await syncAgentWorkspaceInstructions({
        agents,
        client,
        log: input.log,
        runtimeId: input.runtime.id,
    });

    await input.log?.(
        `Synced ${result.synced} agents from ${input.runtime.name}; deleted ${result.deleted} missing agents.`
    );

    return result;
}

export async function syncAgentWorkspaceInstructions(input: {
    agents: AgentRuntimeAgent[];
    client: TavernAgentRuntimeClient;
    log?: SyncLog;
    runtimeId: string;
}) {
    const profiles = await listAgentProfiles({ runtimeId: input.runtimeId });
    const profilesByAgentId = new Map(profiles.map((profile) => [profile.agentId, profile]));

    for (const agent of input.agents) {
        const profile = profilesByAgentId.get(agent.id);
        if (!profile) {
            continue;
        }

        try {
            await input.client.saveWorkspaceInstructions(agent.id, {
                agentName: agent.name,
                soul: profile.soul,
                workspaceDir: agent.workspaceFolder,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await input.log?.(`Skipped workspace instructions sync for ${agent.id}: ${message}`);
        }
    }
}

async function syncChatsForConnection(input: RuntimeSyncInput) {
    const client = createAgentRuntimeClientForConnection(input.runtime);
    const syncedAt = new Date().toISOString();
    const chats = (
        await withCapabilityStatus(
            {
                capability: 'chats',
                method: 'sessions.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listChats()
        )
    ).chats;
    const participantResult = await syncChatParticipantsForRuntime({
        chats,
        syncedAt,
    });

    await input.log?.(
        `Synced ${participantResult.synced} chat participant identities from ${input.runtime.name}.`
    );

    return {
        deleted: 0,
        synced: chats.length,
    };
}

async function syncSessionsForConnection(input: RuntimeSyncInput) {
    const client = createAgentRuntimeClientForConnection(input.runtime);
    const syncedAt = new Date().toISOString();
    const sessions = (
        await withCapabilityStatus(
            {
                capability: 'sessions',
                method: 'sessions.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listSessions()
        )
    ).sessions;
    const result = await syncSessionsForRuntime({
        runtimeId: input.runtime.id,
        sessions,
        syncedAt,
    });
    const messagesBySessionKey = new Map<
        string,
        Awaited<ReturnType<typeof client.listSessionMessages>>['messages']
    >();
    const graphToolCalls: Awaited<ReturnType<typeof client.getSessionGraph>>['toolCalls'] = [];
    const graphToolCallSessionKeys: string[] = [];
    let skippedMessageSyncs = 0;
    let skippedFreshSessionSyncs = 0;
    let skippedToolCallSyncs = 0;

    for (const session of sessions) {
        if (!(await shouldSyncRuntimeSessionDetails({ session }))) {
            skippedFreshSessionSyncs += 1;
            continue;
        }

        try {
            const localSessionKey = session.key;
            const messageState = await getSessionMessageState(localSessionKey);
            const limit = resolveSessionMessageSyncLimit({
                now: syncedAt,
                messageState,
            });
            const response = await client.listSessionMessages(session.key, { limit });

            messagesBySessionKey.set(
                session.key,
                response.messages.map((message) => ({
                    ...message,
                    agentId:
                        message.senderType === 'agent'
                            ? (message.agentId ?? session.agentId)
                            : message.agentId,
                }))
            );
        } catch (error) {
            skippedMessageSyncs += 1;
            const message = error instanceof Error ? error.message : String(error);
            await input.log?.(`Skipped message sync for ${session.key}: ${message}`);
        }

        try {
            const graph = await client.getSessionGraph(session.key);

            graphToolCalls.push(...graph.toolCalls);
            graphToolCallSessionKeys.push(session.key);
        } catch (error) {
            skippedToolCallSyncs += 1;
            const message = error instanceof Error ? error.message : String(error);
            await input.log?.(`Skipped tool call sync for ${session.key}: ${message}`);
        }
    }
    if (skippedMessageSyncs > 0) {
        await recordCapabilityFailure({
            capability: 'messages',
            error: new Error(`Skipped ${skippedMessageSyncs} session message syncs.`),
            method: 'chat.history',
            runtimeId: input.runtime.id,
        });
    } else {
        await recordCapabilitySuccess({
            capability: 'messages',
            method: 'chat.history',
            runtimeId: input.runtime.id,
        });
    }
    const messageResult = await syncSessionMessagesForRuntime({
        messagesBySessionKey,
        runtimeId: input.runtime.id,
        syncedAt,
    });
    const toolCallResult = await syncSessionToolCallsForRuntime({
        runtimeId: input.runtime.id,
        runtimeSessionKeys: graphToolCallSessionKeys,
        syncedAt,
        toolCalls: graphToolCalls,
    });

    await input.log?.(
        `Synced ${result.synced} sessions, ${messageResult.synced} messages, and ${toolCallResult.synced} tool calls from ${input.runtime.name}; skipped ${skippedFreshSessionSyncs} fresh sessions, ${skippedMessageSyncs} message histories, and ${skippedToolCallSyncs} tool call graphs.`
    );

    return {
        synced: result.synced + messageResult.synced + toolCallResult.synced,
    };
}

export async function shouldSyncRuntimeSessionDetails(input: { session: AgentRuntimeSession }) {
    if (hasActiveTurnSession(input.session.key)) {
        return false;
    }

    const messageState = await getSessionMessageState(input.session.key);

    if (!(messageState.hasMessages && messageState.lastSyncedAt)) {
        return true;
    }

    const lastActivityAt = input.session.lastActivityAt ?? input.session.startedAt;

    if (!lastActivityAt) {
        return true;
    }

    const lastSyncedAtMs = Date.parse(messageState.lastSyncedAt);
    const lastActivityAtMs = Date.parse(lastActivityAt);

    if (!(Number.isFinite(lastSyncedAtMs) && Number.isFinite(lastActivityAtMs))) {
        return true;
    }

    return lastActivityAtMs > lastSyncedAtMs;
}

export function resolveSessionMessageSyncLimit(input: {
    messageState: { hasMessages: boolean; lastSyncedAt: string | null };
    now: string;
}) {
    if (!(input.messageState.hasMessages && input.messageState.lastSyncedAt)) {
        return deepSessionMessageLimit;
    }

    const nowMs = Date.parse(input.now);
    const lastSyncedAtMs = Date.parse(input.messageState.lastSyncedAt);

    if (!(Number.isFinite(nowMs) && Number.isFinite(lastSyncedAtMs))) {
        return deepSessionMessageLimit;
    }

    return nowMs - lastSyncedAtMs > deepSessionMessageSyncAfterMs
        ? deepSessionMessageLimit
        : recentSessionMessageLimit;
}

function hasChanged(result: { deleted?: number; synced: number }) {
    return result.synced > 0 || (result.deleted ?? 0) > 0;
}

function emitSessionUpdatedIfChanged(
    result: { deleted?: number; synced: number },
    sessionKey: string
) {
    if (hasChanged(result)) {
        emitSessionUpdated({ sessionKey });
    }
}

function emitSessionDetailUpdatedIfChanged(
    result: { deleted?: number; synced: number },
    sessionKey: string
) {
    if (hasChanged(result)) {
        emitSessionUpdated({ sessionKey });
        emitChatLogUpdated({ sessionKey });
    }
}

async function syncCronForConnection(input: RuntimeSyncInput) {
    const client = createAgentRuntimeClientForConnection(input.runtime);
    const syncedAt = new Date().toISOString();
    const summaries = (
        await withCapabilityStatus(
            {
                capability: 'cron',
                method: 'cron.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listCronJobs()
        )
    ).jobs;
    const jobs = await withCapabilityStatus(
        {
            capability: 'cron',
            method: 'cron.list',
            runtimeId: input.runtime.id,
        },
        async () => await Promise.all(summaries.map((job) => client.getCronJob(job.id)))
    );
    const fullJobs = jobs.filter((job): job is AgentRuntimeCron => Boolean(job));
    const jobResult = await syncCronJobsForRuntime({
        jobs: fullJobs,
        runtimeId: input.runtime.id,
        syncedAt,
    });
    const runs = await syncCronRunsForConnection({
        client,
        jobs: fullJobs,
        log: input.log,
        runtime: input.runtime,
    });

    await upsertCronRuns(
        runs.map((run) =>
            mapCronRunRecord({
                jobs: fullJobs,
                run,
                runtimeId: input.runtime.id,
                syncedAt,
            })
        )
    );
    await input.log?.(
        `Synced ${jobResult.synced} cron jobs and ${runs.length} cron runs from ${input.runtime.name}; deleted ${jobResult.deleted} missing cron jobs.`
    );

    return {
        deleted: jobResult.deleted,
        synced: jobResult.synced + runs.length,
    };
}

async function syncCronRunsForConnection(input: {
    client: ReturnType<typeof createAgentRuntimeClientForConnection>;
    jobs: AgentRuntimeCron[];
    log?: SyncLog;
    runtime: RuntimeConnectionRecord;
}) {
    try {
        const runLists = await Promise.all(
            input.jobs.map((job) => input.client.listCronRuns(job.id))
        );
        await recordCapabilitySuccess({
            capability: 'cronRuns',
            method: 'cron.runs',
            runtimeId: input.runtime.id,
        });

        return runLists.flatMap((response) => response.runs);
    } catch (error) {
        await recordCapabilityFailure({
            capability: 'cronRuns',
            error,
            method: 'cron.runs',
            runtimeId: input.runtime.id,
        });
        const message = error instanceof Error ? error.message : String(error);
        await input.log?.(`Skipped cron run history sync from ${input.runtime.name}: ${message}`);

        return [];
    }
}

function mapCronRunRecord(input: {
    jobs: AgentRuntimeCron[];
    run: AgentRuntimeCronRun;
    runtimeId: string;
    syncedAt: string;
}) {
    const job = input.jobs.find((candidate) => candidate.id === input.run.jobId);
    const runtimeSessionKey = input.run.sessionKey ?? input.run.id;
    const localSessionKey = runtimeSessionKey;

    return {
        agentId: job?.agentId ?? null,
        deliveryStatus: input.run.deliveryStatus,
        durationMs: resolveDurationMs(input.run),
        error: input.run.executionErrorMessage,
        jobId: buildCronJobId({
            runtimeCronJobId: input.run.jobId,
        }),
        providerJobId: input.run.jobId,
        runAt: input.run.scheduledFor,
        runtimeId: input.runtimeId,
        runtimeRunId: input.run.id,
        runtimeSessionKey,
        sessionId: input.run.sessionId ?? input.run.id,
        sessionKey: localSessionKey,
        status: input.run.status,
        summary: input.run.summary,
        syncedAt: input.syncedAt,
        trigger: input.run.trigger,
    };
}

function resolveDurationMs(run: AgentRuntimeCronRun) {
    if (!(run.startedAt && run.finishedAt)) {
        return null;
    }

    const startedAt = Date.parse(run.startedAt);
    const finishedAt = Date.parse(run.finishedAt);

    if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) {
        return null;
    }

    return Math.max(0, finishedAt - startedAt);
}

function emitForPrimitive(kind: SyncPrimitiveKind) {
    switch (kind) {
        case 'agent':
            emitAgentUpdated();
            return;
        case 'cron':
            emitCronUpdated();
            return;
        case 'chat':
            emitChatUpdated();
            return;
        case 'session':
            emitSessionUpdated();
            emitChatLogUpdated();
            return;
        case 'cronRun':
            emitCronUpdated();
            return;
        case 'skill':
            emitSkillUpdated();
            return;
    }
}
