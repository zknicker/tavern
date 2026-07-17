import type {
    TavernCreateChatRequest,
    TavernCreateDeliveryRequest,
    TavernCreateMessageRequest,
    TavernMarkReadRequest,
    TavernUpsertArtifactRequest,
    TavernUpsertResponseActivityRequest,
    TavernUpsertResponseRequest,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { getAgentTurnPromptEvidence } from './agent-turn-store';
import {
    clearChat,
    createChat,
    createDelivery,
    createMessage,
    deleteMessage,
    deleteResponse,
    getChat,
    getChatTimelinePage,
    getMessage,
    getResponse,
    getResponseActivity,
    listActivityForResponses,
    listArtifactsForResponses,
    listChats,
    listEvents,
    listMessages,
    listResponses,
    markRead,
    searchMessages,
    upsertArtifact,
    upsertResponse,
    upsertResponseActivity,
} from './chat-api';
import { badRequest, json, notFound, readJson } from './http';
import { getAgentTurnFileEvidence } from './turn-file-changes';

export async function handleTavernApiRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
        return null;
    }

    try {
        return await route(request, url);
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'Invalid Tavern API request.');
    }
}

async function route(request: Request, url: URL): Promise<Response> {
    if (request.method === 'GET' && url.pathname === '/api/chats') {
        return json(
            listChats({
                cursor: url.searchParams.get('cursor'),
                limit: numberParam(url, 'limit'),
            })
        );
    }

    if (request.method === 'POST' && url.pathname === '/api/chats') {
        return json(createChat((await readJson(request)) as TavernCreateChatRequest), 201);
    }

    if (request.method === 'GET' && url.pathname === '/api/events') {
        return json(
            listEvents({
                afterCursor: url.searchParams.get('after_cursor'),
                limit: numberParam(url, 'limit'),
                recipientId: url.searchParams.get('recipient_id'),
            })
        );
    }

    const chatMessagesMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/u);
    if (chatMessagesMatch) {
        const chatId = decodeURIComponent(chatMessagesMatch[1]);
        if (request.method === 'GET') {
            return json(
                listMessages(chatId, {
                    afterSequence: numberParam(url, 'after_sequence'),
                    beforeSequence: numberParam(url, 'before_sequence'),
                    limit: numberParam(url, 'limit'),
                })
            );
        }
        if (request.method === 'POST') {
            const receipt = createMessage(
                chatId,
                (await readJson(request)) as TavernCreateMessageRequest
            );
            return json(receipt, receipt.idempotent ? 200 : 201);
        }
    }

    const chatMessageSearchMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages\/search$/u);
    if (chatMessageSearchMatch && request.method === 'GET') {
        return json(
            searchMessages(decodeURIComponent(chatMessageSearchMatch[1]), {
                limit: numberParam(url, 'limit'),
                query: url.searchParams.get('query') ?? '',
            })
        );
    }

    const chatTimelineMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/timeline$/u);
    if (chatTimelineMatch && request.method === 'GET') {
        return json(
            getChatTimelinePage(decodeURIComponent(chatTimelineMatch[1]), {
                beforeSequence: numberParam(url, 'before_sequence'),
                limit: numberParam(url, 'limit'),
            })
        );
    }

    // Turn evidence: one response's execution record (activity + artifacts),
    // queried on demand instead of riding the timeline page.
    const responseEvidenceMatch = url.pathname.match(
        /^\/api\/chats\/([^/]+)\/responses\/([^/]+)\/evidence$/u
    );
    if (responseEvidenceMatch && request.method === 'GET') {
        const chatId = decodeURIComponent(responseEvidenceMatch[1]);
        const responseId = decodeURIComponent(responseEvidenceMatch[2]);
        const response = getResponse(responseId);

        if (!response || response.chat_id !== chatId) {
            return notFound();
        }

        const db = getDb();

        return json({
            activity: listActivityForResponses([responseId], db),
            artifacts: listArtifactsForResponses([responseId], db),
            reply_message: response.response_message_id
                ? getMessage(response.response_message_id, db)
                : null,
            response,
        });
    }

    const chatResponsesMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/responses$/u);
    if (chatResponsesMatch) {
        const chatId = decodeURIComponent(chatResponsesMatch[1]);
        if (request.method === 'GET') {
            return json(
                listResponses(chatId, {
                    afterSequence: numberParam(url, 'after_sequence'),
                    limit: numberParam(url, 'limit'),
                })
            );
        }
        if (request.method === 'POST') {
            const result = upsertResponse(
                chatId,
                (await readJson(request)) as TavernUpsertResponseRequest
            );
            return json(result.response, result.created ? 201 : 200);
        }
    }

    const responseActivityMatch = url.pathname.match(
        /^\/api\/chats\/([^/]+)\/responses\/([^/]+)\/activity$/u
    );
    if (responseActivityMatch && request.method === 'POST') {
        const chatId = decodeURIComponent(responseActivityMatch[1]);
        const responseId = decodeURIComponent(responseActivityMatch[2]);
        const result = upsertResponseActivity(
            chatId,
            responseId,
            (await readJson(request)) as TavernUpsertResponseActivityRequest
        );
        return json(result.activity, result.created ? 201 : 200);
    }

    const chatActivityMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/activity\/([^/]+)$/u);
    if (chatActivityMatch && request.method === 'GET') {
        const chatId = decodeURIComponent(chatActivityMatch[1]);
        const activityId = decodeURIComponent(chatActivityMatch[2]);
        const activity = getResponseActivity(activityId);
        return activity?.chat_id === chatId ? json(activity) : notFound();
    }

    const chatChildMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/([^/]+)$/u);
    if (chatChildMatch && request.method === 'POST') {
        const chatId = decodeURIComponent(chatChildMatch[1]);
        const child = chatChildMatch[2];
        if (child === 'deliveries') {
            const receipt = createDelivery(
                chatId,
                (await readJson(request)) as TavernCreateDeliveryRequest
            );
            return json(receipt, receipt.idempotent ? 200 : 201);
        }
        if (child === 'artifacts') {
            const result = upsertArtifact(
                chatId,
                (await readJson(request)) as TavernUpsertArtifactRequest
            );
            return json(result.artifact, result.created ? 201 : 200);
        }
        if (child === 'read') {
            return json(markRead(chatId, (await readJson(request)) as TavernMarkReadRequest));
        }
        if (child === 'clear') {
            return json(clearChat(chatId));
        }
    }

    const chatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/u);
    if (chatMatch && request.method === 'GET') {
        const chat = getChat(decodeURIComponent(chatMatch[1]));
        return chat ? json(chat) : notFound();
    }

    const responseMatch = url.pathname.match(/^\/api\/responses\/([^/]+)$/u);
    if (responseMatch && request.method === 'DELETE') {
        return json(deleteResponse(decodeURIComponent(responseMatch[1])));
    }

    const turnPromptMatch = url.pathname.match(/^\/api\/turns\/([^/]+)\/prompt$/u);
    if (turnPromptMatch && request.method === 'GET') {
        const runId = decodeURIComponent(turnPromptMatch[1]);
        const evidence = getAgentTurnPromptEvidence(runId);
        return evidence
            ? json({
                  captured_at: evidence.capturedAt,
                  instructions: evidence.instructions,
                  prompt: evidence.prompt,
                  recall: evidence.recall,
                  run_id: runId,
              })
            : notFound();
    }

    const turnFileChangesMatch = url.pathname.match(/^\/api\/turns\/([^/]+)\/file-changes$/u);
    if (turnFileChangesMatch && request.method === 'GET') {
        const runId = decodeURIComponent(turnFileChangesMatch[1]);
        const evidence = getAgentTurnFileEvidence(runId);
        return evidence
            ? json({
                  captured_at: evidence.capturedAt,
                  changes: evidence.changes.map((change) => ({
                      additions: change.additions,
                      after_size: change.afterSize,
                      after_text: change.afterText,
                      before_size: change.beforeSize,
                      before_text: change.beforeText,
                      change: change.change,
                      deletions: change.deletions,
                      omitted: change.omitted,
                      path: change.path,
                  })),
                  run_id: runId,
                  truncated: evidence.truncated,
              })
            : notFound();
    }

    const messageMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/u);
    if (messageMatch) {
        const messageId = decodeURIComponent(messageMatch[1]);
        if (request.method === 'GET') {
            const message = getMessage(messageId);
            return message ? json(message) : notFound();
        }
        if (request.method === 'DELETE') {
            return json(deleteMessage(messageId));
        }
    }

    return notFound();
}

function numberParam(url: URL, name: string) {
    const value = url.searchParams.get(name);
    if (!value) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
