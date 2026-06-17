import { setTimeout as delay } from 'node:timers/promises';
import type { AgentRuntimeAgent, AgentRuntimeCron } from '@tavern/api';
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
import { toCronRunInsert } from '../cron/runtime-run-record.ts';
import { syncChatParticipantsForRuntime } from '../participants/chat-participants.ts';
import {
    listReachableAgentRuntimeConnections,
    markAgentRuntimeConnectionSync,
} from '../storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../storage/agents.ts';
import { syncCronJobsForRuntime } from '../storage/cron-jobs.ts';
import { reconcileSyntheticCronTriggerRuns, upsertCronRuns } from '../storage/cron-runs.ts';
import type { SyncPrimitiveKind } from './contracts.ts';
import { savePrimitiveSyncState } from './primitive-sync-state.ts';

type SyncLog = (message: string) => Promise<void>;
type RuntimeConnectionRecord = Awaited<
    ReturnType<typeof listReachableAgentRuntimeConnections>
>[number];

interface SyncInput {
    emitUpdates?: boolean;
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
    const sessions = (
        await withCapabilityStatus(
            {
                capability: 'apiServer',
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

    await input.log?.(`Synced session ${input.sessionKey}.`);
    emitSessionUpdated({ sessionKey: input.sessionKey });

    return { synced: 1 };
}

export async function syncAgentRuntimeSessionMessages(input: {
    client: Pick<TavernAgentRuntimeClient, 'listSessionMessages'>;
    agentId?: null | string;
    log?: SyncLog;
    runtimeId: string;
    sessionKey: string;
    syncedAt?: string;
}) {
    const response = await withCapabilityStatus(
        {
            capability: 'apiServer',
            method: 'chat.history',
            runtimeId: input.runtimeId,
        },
        async () => await input.client.listSessionMessages(input.sessionKey)
    );
    const messages = response.messages.map((message) => ({
        ...message,
        agentId:
            message.senderType === 'agent'
                ? (message.agentId ?? input.agentId ?? null)
                : message.agentId,
    }));

    await input.log?.(`Read ${messages.length} messages for session ${input.sessionKey}.`);
    emitSessionUpdated({ sessionKey: input.sessionKey });
    emitChatLogUpdated({ sessionKey: input.sessionKey });

    return { deleted: 0, messages, synced: messages.length };
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

    if (input?.emitUpdates !== false && results.some(hasChanged)) {
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
                capability: 'apiServer',
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
    for (const agent of input.agents) {
        if (!agent.workspaceFolder) {
            continue;
        }

        try {
            await input.client.saveWorkspaceInstructions(agent.id, {
                agentName: agent.name,
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
                capability: 'apiServer',
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
    const sessions = (
        await withCapabilityStatus(
            {
                capability: 'apiServer',
                method: 'sessions.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listSessions()
        )
    ).sessions;

    await input.log?.(`Read ${sessions.length} stored sessions from ${input.runtime.name}.`);

    return {
        synced: sessions.length,
    };
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

async function syncCronForConnection(input: RuntimeSyncInput) {
    const client = createAgentRuntimeClientForConnection(input.runtime);
    const syncedAt = new Date().toISOString();
    const summaries = (
        await withCapabilityStatus(
            {
                capability: 'apiServer',
                method: 'cron.list',
                runtimeId: input.runtime.id,
            },
            async () => await client.listCronJobs()
        )
    ).jobs;
    const jobs = await withCapabilityStatus(
        {
            capability: 'apiServer',
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
            toCronRunInsert({
                job: fullJobs.find((candidate) => candidate.id === run.jobId),
                run,
                runtimeId: input.runtime.id,
                syncedAt,
            })
        )
    );
    const reconciliation = await reconcileSyntheticCronTriggerRuns({
        runtimeId: input.runtime.id,
        staleBefore: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        syncedAt,
    });
    await input.log?.(
        `Synced ${jobResult.synced} cron jobs and ${runs.length} cron runs from ${input.runtime.name}; deleted ${jobResult.deleted} missing cron jobs; reconciled ${reconciliation.deleted} trigger acknowledgements.`
    );

    return {
        deleted: jobResult.deleted + reconciliation.deleted,
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
            capability: 'apiServer',
            method: 'cron.runs',
            runtimeId: input.runtime.id,
        });

        return runLists.flatMap((response) => response.runs);
    } catch (error) {
        await recordCapabilityFailure({
            capability: 'apiServer',
            error,
            method: 'cron.runs',
            runtimeId: input.runtime.id,
        });
        const message = error instanceof Error ? error.message : String(error);
        await input.log?.(`Skipped cron run history sync from ${input.runtime.name}: ${message}`);

        return [];
    }
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
