import type {
    TavernCreateChatRequest,
    TavernCreateDeliveryRequest,
    TavernCreateMessageRequest,
    TavernMarkReadRequest,
    TavernUpdateActivityRequest,
} from '@tavern/api';
import {
    createChat,
    createDelivery,
    createMessage,
    deleteMessage,
    getChat,
    getMessage,
    listActivity,
    listChats,
    listEvents,
    listMessages,
    markRead,
    updateActivity,
} from './chat-api';
import { badRequest, json, notFound, readJson } from './http';

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

    if (request.method === 'GET' && url.pathname === '/api/activity') {
        return json(listActivity());
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
        if (child === 'activity') {
            return json(
                updateActivity(chatId, (await readJson(request)) as TavernUpdateActivityRequest)
            );
        }
        if (child === 'read') {
            return json(markRead(chatId, (await readJson(request)) as TavernMarkReadRequest));
        }
    }

    const chatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/u);
    if (chatMatch && request.method === 'GET') {
        const chat = getChat(decodeURIComponent(chatMatch[1]));
        return chat ? json(chat) : notFound();
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
