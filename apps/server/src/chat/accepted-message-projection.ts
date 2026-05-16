import type {
    AgentRuntimeChatMessageAcceptedEvent,
    AgentRuntimeSessionMessage,
} from '@tavern/agent-runtime-protocol';
import { db } from '../db/index.ts';
import { sessionMessagesTable } from '../db/schema.ts';

export async function projectAcceptedChatMessage(input: {
    event: AgentRuntimeChatMessageAcceptedEvent;
    runtimeId: string;
}) {
    const message: AgentRuntimeSessionMessage = {
        agentId: null,
        attachments: [],
        chatId: input.event.chatId,
        content: input.event.message.text,
        id: input.event.message.id,
        metadata: {
            tavern: {
                acceptedAgentId: input.event.agentId,
                acceptedRunId: input.event.runId,
                acceptedRuntimeId: input.runtimeId,
            },
        },
        participant: null,
        sender: input.event.message.senderId,
        senderName: input.event.message.senderName,
        senderType: 'user',
        sessionKey: input.event.sessionKey,
        timestamp: input.event.message.timestamp,
    };
    const timestamp = input.event.timestamp;

    await db
        .insert(sessionMessagesTable)
        .values({
            actorId: null,
            actorKind: null,
            api: null,
            canonicalModelId: null,
            contentJson: null,
            contentText: message.content,
            errorMessage: null,
            externalMessageId: message.id,
            id: message.id,
            model: null,
            openClawApi: null,
            openClawHarness: null,
            openClawModel: null,
            openClawModelNameId: null,
            openClawProvider: null,
            provider: null,
            rawJson: JSON.stringify(message),
            role: message.senderType,
            senderLabel: message.senderName,
            seq: input.event.message.sequence,
            sessionKey: input.event.sessionKey,
            stopReason: null,
            syncedAt: timestamp,
            timestamp: message.timestamp,
            usageJson: null,
        })
        .onConflictDoUpdate({
            target: sessionMessagesTable.id,
            set: {
                contentText: message.content,
                externalMessageId: message.id,
                rawJson: JSON.stringify(message),
                role: message.senderType,
                senderLabel: message.senderName,
                seq: input.event.message.sequence,
                sessionKey: input.event.sessionKey,
                syncedAt: timestamp,
                timestamp: message.timestamp,
            },
        });
}
