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
import { type DevelopmentDemoMessage, demoAgentId, demoTime } from './development-chat-demo-types';
import { ensurePrimaryManagedAgent } from './managed-agent';

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
                    color: demo.color ?? null,
                    displayName: demo.title,
                    id: demo.chatId,
                }),
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

        seedDemoAgentSessions(demo.chatId, db);
    }

    return { seeded: developmentChatDemos.length };
}

// Archived Agent sessions as agent-drawer scenery: the demo transcript reads
// as the tail of two earlier sessions. Live session rows always win — inserts
// use ON CONFLICT DO NOTHING, and demo responses are only tied to session
// rows this seeder authored, so real turns keep their own counts.
function seedDemoAgentSessions(chatId: string, db: Database) {
    // The demo agent is the primary managed agent; the sessions FK needs its
    // agents row, which may not exist yet on a fresh database.
    ensurePrimaryManagedAgent(db);
    const sessions = [
        {
            archivedAt: '2026-06-13T20:15:00.000Z',
            createdAt: '2026-06-12T10:00:00.000Z',
            generation: 1,
            model: { model: 'claude-opus-4-8', provider: 'claude' },
        },
        {
            archivedAt: '2026-06-15T17:40:00.000Z',
            createdAt: '2026-06-13T20:15:00.000Z',
            generation: 2,
            model: { model: 'gpt-5.5', provider: 'codex' },
        },
        {
            archivedAt: '2026-06-16T18:30:00.000Z',
            createdAt: '2026-06-15T17:40:00.000Z',
            generation: 3,
            model: { model: 'claude-sonnet-5', provider: 'claude' },
        },
        {
            archivedAt: demoTime,
            createdAt: '2026-06-16T18:30:00.000Z',
            generation: 4,
            model: { model: 'gpt-5.5', provider: 'codex' },
        },
    ];

    const seededSessionIds: string[] = [];
    for (const session of sessions) {
        const id = demoSessionId(chatId, session.generation);
        // Refresh rows this seeder authored on earlier boots (archived, no
        // engine session, no resume state) so timestamp or model changes in
        // the definitions land; anything a real turn touched stays put.
        db.prepare(
            `DELETE FROM agent_sessions
             WHERE id = $id
               AND status = 'archived'
               AND runtime_session_id IS NULL
               AND resume_state_json IS NULL
               AND prompt_context_sequence = 0`
        ).run(namedParams({ id }));
        db.prepare(
            `INSERT INTO agent_sessions (
                id, chat_id, agent_participant_id, agent_id, generation,
                effective_model_json, runtime_session_id, resume_state_json,
                prompt_context_sequence, status, created_at, updated_at, archived_at
             )
             VALUES ($id, $chatId, $agentParticipantId, $agentId, $generation,
              $effectiveModelJson, NULL, NULL, 0, 'archived', $createdAt, $archivedAt, $archivedAt)
             ON CONFLICT(id) DO NOTHING`
        ).run(
            namedParams({
                agentId: demoAgentId,
                agentParticipantId: demoAgentId,
                archivedAt: session.archivedAt,
                chatId,
                createdAt: session.createdAt,
                effectiveModelJson: JSON.stringify(session.model),
                generation: session.generation,
                id,
            })
        );

        // A conflicting live row keeps its id; only rows this seeder authored
        // (archived, demo timestamps) receive demo turn lineage.
        const stored = db
            .prepare(
                `SELECT 1 FROM agent_sessions
                 WHERE id = $id AND status = 'archived' AND created_at = $createdAt`
            )
            .get(namedParams({ createdAt: session.createdAt, id })) as unknown;
        if (stored) {
            seededSessionIds.push(id);
        }
    }

    if (seededSessionIds.length === 0) {
        return;
    }

    const demoResponseIds = db
        .prepare(
            `SELECT id FROM chat_responses
             WHERE chat_id = $chatId
               AND json_extract(metadata_json, '$.runtime.source') = 'development-demo'
             ORDER BY created_at ASC, id ASC`
        )
        .all(namedParams({ chatId })) as { id: string }[];
    const perSession = Math.ceil(demoResponseIds.length / seededSessionIds.length);

    for (const [index, row] of demoResponseIds.entries()) {
        const sessionId =
            seededSessionIds[Math.min(Math.floor(index / perSession), seededSessionIds.length - 1)];
        db.prepare(
            `UPDATE chat_responses
             SET metadata_json = json_set(metadata_json, '$.runtime.agentSessionId', $sessionId)
             WHERE id = $id`
        ).run(namedParams({ id: row.id, sessionId }));
    }
}

function demoSessionId(chatId: string, generation: number) {
    return `ags_${chatId}_${demoAgentId}_${generation}`;
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

function tavernChatMetadata(input: {
    agentIds: string[];
    color: string | null;
    displayName: string;
    id: string;
}) {
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
            tabAppearance: { color: input.color },
        },
    };
}

function tavernSessionKey(agentId: string, chatId: string) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
