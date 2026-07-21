import { TRPCError } from '@trpc/server';
import type { CronJobSummary } from '../cron/contracts.ts';
import { listCronJobs } from '../cron/list.ts';
import { sessionSchema } from '../sessions/contracts.ts';
import {
    listRuntimeSessionPreviewsForKeys,
    listRuntimeSessions,
} from '../sessions/runtime-sessions.ts';
import { listLogs } from '../storage/logs.ts';
import { getAgent } from './catalog.ts';
import type { AgentDetail } from './contracts.ts';
import { buildAgentPalette, resolveAgentName } from './palette.ts';

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
                successRate: record.state.lastRunStatus ?? 'unknown',
                target: record.agentId,
            };
        });
}

export async function getAgentDetail(agentId: string): Promise<AgentDetail> {
    const agent = await getAgent(agentId);

    if (!agent) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No Grotto agent named "${agentId}" exists.`,
        });
    }

    const [runtimeSessions, cronJobList, logs] = await Promise.all([
        listRuntimeSessions(),
        listCronJobs(),
        listLogs(),
    ]);
    const cronJobRecords = cronJobList.jobs;
    const palette = buildAgentPalette(agent);
    const sessionsForAgent = runtimeSessions.filter((session) => session.agentId === agentId);
    const previewsBySessionKey = await listRuntimeSessionPreviewsForKeys(
        sessionsForAgent.map((session) => session.key),
        { limit: 3, maxChars: 180 }
    );
    const sessions = await Promise.all(
        sessionsForAgent.map(async (sessionRecord) => {
            const timestamp =
                sessionRecord.lastActivityAt ??
                sessionRecord.startedAt ??
                new Date(0).toISOString();
            const messages = (previewsBySessionKey.get(sessionRecord.key)?.items ?? []).map(
                (item, index) => ({
                    content: item.text,
                    id: `${sessionRecord.key}:preview:${index}`,
                    sender: item.role,
                    senderType:
                        item.role === 'assistant' || item.role === 'agent'
                            ? 'agent'
                            : item.role === 'user'
                              ? 'user'
                              : 'system',
                    timestamp,
                })
            );

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
