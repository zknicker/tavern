import type { TavernCreateMessageRequest } from '@tavern/api';
import { obsoleteDevelopmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { AGENT_WORKSPACE } from '../config';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { registerAgentWorkspace } from '../workspace/instructions';
import {
    createChat,
    createMessage,
    getMessage,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';
import { developmentChatDemos } from './development-chat-demo-definitions';
import { type DevelopmentDemoMessage, demoAgentId } from './development-chat-demo-types';

export function shouldSeedDevelopmentChatDemos() {
    return process.env.TAVERN_DEV_STACK === '1';
}

export function seedDevelopmentChatDemos({
    db,
    enabled = shouldSeedDevelopmentChatDemos(),
}: {
    db: Database;
    enabled?: boolean;
}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    registerAgentWorkspace(db, {
        agentId: demoAgentId,
        agentName: 'Tavern',
        workspaceDir: AGENT_WORKSPACE,
    });
    pruneObsoleteDevelopmentDemoChats(db);

    for (const demo of developmentChatDemos) {
        createChat(
            {
                id: demo.chatId,
                metadata: tavernChatMetadata({
                    agentIds: [demoAgentId],
                    displayName: demo.title,
                    id: demo.chatId,
                }),
                pinned: false,
                title: demo.title,
            },
            db
        );

        for (const message of demo.messages) {
            seedMessage(demo.chatId, message, db);
        }

        for (const { activities = [], ...response } of demo.responses) {
            upsertResponse(demo.chatId, response, db);
            replaceResponseActivities(response.id, db);
            for (const activity of activities) {
                upsertResponseActivity(demo.chatId, response.id, activity, db);
            }
        }
    }

    return { seeded: developmentChatDemos.length };
}

function pruneObsoleteDevelopmentDemoChats(db: Database) {
    const transaction = db.transaction(() => {
        for (const chatId of obsoleteDevelopmentChatDemoIds) {
            const params = namedParams({ chatId });

            db.prepare('DELETE FROM chat_artifacts WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_response_activity WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM agent_turns WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_responses WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_deliveries WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_reads WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_events WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM agent_sessions WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_messages WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_participants WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chats WHERE id = $chatId').run(params);
        }
    });

    transaction();
}

function replaceResponseActivities(responseId: string, db: Database) {
    db.prepare('DELETE FROM chat_response_activity WHERE response_id = $responseId').run(
        namedParams({ responseId })
    );
}

function seedMessage(chatId: string, input: DevelopmentDemoMessage, db: Database) {
    if (getMessage(input.id, db)) {
        upsertDemoParticipant(chatId, input.author_id, input.role, db);
        db.prepare(
            `UPDATE chat_messages
             SET author_id = $authorId,
                 role = $role,
                 content = $content,
                 attachment_json = $attachmentJson,
                 nonce = $nonce,
                 parent_message_id = $parentMessageId,
                 thread_root_id = $threadRootId,
                 metadata_json = $metadataJson,
                 deleted_at = NULL
             WHERE id = $id`
        ).run(
            namedParams({
                attachmentJson:
                    input.attachments === undefined || input.attachments.length === 0
                        ? null
                        : JSON.stringify(input.attachments),
                authorId: input.author_id,
                content: input.content,
                id: input.id,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                nonce: input.nonce ?? null,
                parentMessageId: input.parent_message_id ?? null,
                role: input.role,
                threadRootId: input.thread_root_id ?? null,
            })
        );
        setMessageTimestamp(input.id, input.createdAt, db);
        return;
    }

    createMessage(chatId, input, db);
    setMessageTimestamp(input.id, input.createdAt, db);
}

function upsertDemoParticipant(
    chatId: string,
    id: string,
    role: TavernCreateMessageRequest['role'],
    db: Database
) {
    db.prepare(
        `INSERT INTO chat_participants (chat_id, id, kind, label, metadata_json)
         VALUES ($chatId, $id, $kind, NULL, '{}')
         ON CONFLICT(chat_id, id) DO UPDATE SET kind = excluded.kind`
    ).run(namedParams({ chatId, id, kind: role === 'assistant' ? 'agent' : role }));
}

function setMessageTimestamp(messageId: string, timestamp: string, db: Database) {
    db.prepare('UPDATE chat_messages SET created_at = $timestamp WHERE id = $messageId').run(
        namedParams({ messageId, timestamp })
    );
}

function tavernChatMetadata(input: { agentIds: string[]; displayName: string; id: string }) {
    return {
        runtime: {
            source: 'tavern',
        },
        sessionKeys: input.agentIds.map((agentId) => tavernSessionKey(agentId, input.id)),
        tavern: {
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            displayNameSource: 'explicit',
            tabAppearance: { color: null },
        },
    };
}

function tavernSessionKey(agentId: string, chatId: string) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
