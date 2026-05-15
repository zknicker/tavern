import { TRPCError } from '@trpc/server';
import type { ActorRef } from '../actors/contracts.ts';
import type { CronJobSummary } from '../cron/contracts.ts';
import { listCronJobs } from '../cron/list.ts';
import { sessionSchema } from '../sessions/contracts.ts';
import { listLogs } from '../storage/logs.ts';
import { listSessionMessagesForSessionKeys } from '../storage/session-messages.ts';
import { listSessionProjections, parseSessionProjection } from '../storage/sessions.ts';
import { getAgent } from './catalog.ts';
import type { AgentDetail } from './contracts.ts';
import { buildAgentPalette, resolveAgentAvatar, resolveAgentName } from './palette.ts';

function mapAgentCronJobs(agentId: string, records: CronJobSummary[]): AgentDetail['cronJobs'] {
    return records
        .filter((record) => record.agentId === agentId)
        .map((record) => {
            return {
                cadence: JSON.stringify(record.schedule),
                description: record.description ?? '',
                id: record.id,
                lastRunAt: record.state.lastRunAtMs
                    ? new Date(record.state.lastRunAtMs).toISOString()
                    : record.updatedAt,
                name: record.name,
                schedule: JSON.stringify(record.schedule),
                state: record.enabled ? 'enabled' : 'paused',
                successRate: record.state.lastStatus ?? 'unknown',
                target: record.agentId ?? record.id,
            };
        });
}

export async function getAgentDetail(agentId: string): Promise<AgentDetail> {
    const agent = await getAgent(agentId);

    if (!agent) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No Tavern agent named "${agentId}" exists.`,
        });
    }

    const [sessionRecords, cronJobList, logs] = await Promise.all([
        listSessionProjections(),
        listCronJobs(),
        listLogs(),
    ]);
    const cronJobRecords = cronJobList.jobs;
    const palette = buildAgentPalette(agent);
    const sessionsForAgent = sessionRecords
        .map(parseSessionProjection)
        .filter((record): record is NonNullable<typeof record> => record?.agentId === agentId);
    const messagesBySessionKey = await buildMessagesBySessionKey(
        sessionsForAgent.map((session) => session.key)
    );
    const sessions = await Promise.all(
        sessionsForAgent.map(async (sessionRecord) => {
            const messages = messagesBySessionKey.get(sessionRecord.key) ?? [];

            return sessionSchema.parse({
                duration: 'live',
                id: sessionRecord.sessionId,
                messageCount: sessionRecord.messageCount,
                messages,
                parentSessionKey: sessionRecord.parentSessionKey,
                platform: sessionRecord.platform,
                prompt: sessionRecord.title,
                result:
                    messages.at(-1)?.content ?? 'No transcript messages have been observed yet.',
                spawnedBy: sessionRecord.parentSessionKey,
                startedAt:
                    sessionRecord.startedAt ??
                    sessionRecord.lastActivityAt ??
                    new Date(0).toISOString(),
                state: 'idle',
                title: sessionRecord.title,
                toolCalls: 0,
            });
        })
    );

    return {
        agent: {
            accentFrom: palette.accentFrom,
            accentTo: palette.accentTo,
            avatar: resolveAgentAvatar(agent),
            chatCount: new Set(sessionsForAgent.map((session) => session.chatId)).size,
            cronCount: cronJobRecords.filter((record) => record.agentId === agentId).length,
            description: 'Runtime-backed agent.',
            id: agent.id,
            kind: 'agent',
            layout: {
                x: 50,
                y: 50,
            },
            memoryCount: 0,
            name: resolveAgentName(agent),
            parentId: null,
            peerIds: [],
            sessionCount: sessions.length,
            title: agent.name,
        },
        cronJobs: mapAgentCronJobs(agentId, cronJobRecords),
        logs: logs.filter((log) => log.source.includes(agentId) || log.message.includes(agentId)),
        memories: [],
        sessions,
        subAgents: [],
    };
}

async function buildMessagesBySessionKey(sessionKeys: string[]) {
    const records = await listSessionMessagesForSessionKeys(sessionKeys);
    const buckets = new Map<
        string,
        NonNullable<AgentDetail['sessions'][number]['messages']>[number][]
    >();

    for (const record of records) {
        const bucket = buckets.get(record.sessionKey) ?? [];
        const actor = resolveStoredActor(record.actorKind, record.actorId);

        bucket.push({
            actor,
            tavernAgentId: record.actorKind === 'agent' ? record.actorId : null,
            content: record.contentText ?? '',
            id: record.id,
            sender: record.senderLabel ?? record.role,
            senderType: record.role === 'agent' || record.role === 'user' ? record.role : 'system',
            timestamp: record.timestamp ?? record.syncedAt,
        });
        buckets.set(record.sessionKey, bucket);
    }

    return buckets;
}

function resolveStoredActor(kind: string | null, id: string | null): ActorRef | null {
    if (!(id && (kind === 'agent' || kind === 'participant' || kind === 'profile'))) {
        return null;
    }

    return {
        id,
        kind,
    };
}
