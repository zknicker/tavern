import type { CronJob } from '../cron/contracts.ts';
import type { LiveSession } from '../sessions/messages.ts';
import { deriveAgentId } from '../sessions/messages.ts';
import type { SessionActivitySnapshot } from './snapshot.ts';

type BoundCronJob = CronJob & {
    providerJobId?: string | null;
};

function findSourceSession(sessions: LiveSession[], providerJobId: string | null | undefined) {
    if (!providerJobId) {
        return null;
    }

    return sessions.find((session) => session.key.endsWith(`:cron:${providerJobId}`)) ?? null;
}

function findTargetSession(input: {
    sessions: LiveSession[];
    targetChatId: string;
    sourceSession: LiveSession;
}) {
    const matches = input.sessions.filter((session) => {
        const rawSession = session as unknown as Record<string, unknown>;
        return rawSession.chatId === input.targetChatId;
    });

    return (
        matches.find(
            (session) => deriveAgentId(session.key) === deriveAgentId(input.sourceSession.key)
        ) ??
        matches[0] ??
        null
    );
}

function findLatestAssistantMessage(activity: SessionActivitySnapshot, sessionKey: string) {
    return [...activity.messages]
        .filter(
            (message) =>
                message.sessionKey === sessionKey &&
                message.role === 'assistant' &&
                typeof message.contentText === 'string' &&
                message.contentText.trim().length > 0
        )
        .sort((left, right) => {
            const leftSeq = left.seq ?? -1;
            const rightSeq = right.seq ?? -1;

            if (leftSeq !== rightSeq) {
                return rightSeq - leftSeq;
            }

            return (right.timestamp ?? '').localeCompare(left.timestamp ?? '');
        })[0];
}

export function synthesizeCronAnnounceDeliveries(input: {
    activity: SessionActivitySnapshot;
    cronJobs: BoundCronJob[];
    sessions: LiveSession[];
    syncedAt: string;
}) {
    const existingDeliveryIds = new Set(
        input.activity.deliveries.map(
            (delivery) =>
                `${delivery.parentSessionKey}:${delivery.childSessionKey}:${delivery.sourceMessageId ?? ''}`
        )
    );

    return input.cronJobs.flatMap((job) => {
        const deliveryChatId = job.delivery?.chatId ?? null;

        if (!deliveryChatId) {
            return [];
        }

        const sourceSession = findSourceSession(input.sessions, job.providerJobId ?? job.id);
        if (!sourceSession) {
            return [];
        }

        const targetSession = findTargetSession({
            sessions: input.sessions,
            sourceSession,
            targetChatId: deliveryChatId,
        });
        if (!targetSession) {
            return [];
        }

        const latestAssistantMessage = findLatestAssistantMessage(
            input.activity,
            sourceSession.key
        );
        if (!latestAssistantMessage?.contentText) {
            return [];
        }

        const deliveryId = `${sourceSession.key}:${targetSession.key}:${latestAssistantMessage.id}`;
        if (existingDeliveryIds.has(deliveryId)) {
            return [];
        }

        existingDeliveryIds.add(deliveryId);

        const deliveryChannel = deliveryChatId.split(':', 1)[0] ?? null;

        return [
            {
                childSessionKey: targetSession.key,
                createdAt: input.syncedAt,
                cronJobId: job.id,
                deliveredAt: latestAssistantMessage.timestamp ?? input.syncedAt,
                deliveryChannel,
                deliveryTarget: deliveryChatId,
                id: `synthetic:delivery:${deliveryId}`,
                mode: 'announce',
                parentSessionKey: sourceSession.key,
                payloadJson: JSON.stringify({
                    channel: deliveryChannel,
                    chatId: deliveryChatId,
                    cronJobId: job.id,
                    text: latestAssistantMessage.contentText,
                }),
                runId: null,
                sourceMessageId: latestAssistantMessage.id,
                statsJson: null,
                status: 'delivered',
                streamLogPath: null,
                targetMessageId: null,
                transcriptPath: null,
                updatedAt: input.syncedAt,
            },
        ];
    });
}
