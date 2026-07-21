import { ZodError } from 'zod';
import { AgentApiError } from './agent-api-errors.ts';
import {
    readAgentChannelInfo,
    readAgentChannelMembers,
    readAgentServerInfo,
} from './agent-directory.ts';
import { readAgentDraft } from './agent-drafts.ts';
import { getAgentMessage, readAgentHistory, searchAgentMessages } from './agent-history.ts';
import { agentSendRequestSchema, sendAgentMessage } from './agent-send.ts';
import { agentThreadUnfollowRequestSchema, unfollowAgentThread } from './agent-threads.ts';
import { AmbiguousMessageIdError } from './chat-api/index.ts';
import { json, readJson } from './http.ts';

export async function handleAgentApiRequest(
    request: Request,
    agentId: string
): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/agent/')) {
        return null;
    }
    try {
        return await route(request, url, agentId);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            return agentError('AMBIGUOUS_ID', error.message, 409, 'Use the full message id.');
        }
        if (error instanceof AgentApiError) {
            return agentError(error.code, error.message, error.status, error.nextAction);
        }
        if (error instanceof ZodError) {
            return agentError('INVALID_ARG', error.issues[0]?.message ?? 'Invalid request.', 400);
        }
        throw error;
    }
}

async function route(request: Request, url: URL, agentId: string): Promise<Response> {
    if (request.method === 'POST' && url.pathname === '/api/agent/messages/send') {
        return handleSend(request, agentId);
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/history') {
        return json(
            readAgentHistory(agentId, {
                after: url.searchParams.get('after'),
                around: url.searchParams.get('around'),
                before: url.searchParams.get('before'),
                limit: numberParam(url, 'limit'),
                target: requiredParam(url, 'target'),
            })
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/messages/search') {
        return json(
            searchAgentMessages(agentId, {
                after: url.searchParams.get('after'),
                before: url.searchParams.get('before'),
                limit: numberParam(url, 'limit'),
                offset: numberParam(url, 'offset'),
                q: requiredParam(url, 'q'),
                sender: url.searchParams.get('sender'),
                sort: url.searchParams.get('sort'),
                target: url.searchParams.get('target'),
            })
        );
    }
    const messageMatch = url.pathname.match(/^\/api\/agent\/messages\/([^/]+)$/u);
    if (request.method === 'GET' && messageMatch?.[1]) {
        return json(getAgentMessage(agentId, decodeURIComponent(messageMatch[1])));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/server') {
        return json(
            readAgentServerInfo(agentId, {
                agents: booleanParam(url, 'agents'),
                channels: booleanParam(url, 'channels'),
                humans: booleanParam(url, 'humans'),
                joined: booleanParam(url, 'joined'),
                limit: numberParam(url, 'limit'),
                offset: numberParam(url, 'offset'),
                query: url.searchParams.get('query') ?? undefined,
            })
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/threads/unfollow') {
        return json(
            unfollowAgentThread(
                agentId,
                agentThreadUnfollowRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/channels/info') {
        return json(readAgentChannelInfo(agentId, requiredParam(url, 'target')));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/channels/members') {
        return json(readAgentChannelMembers(agentId, requiredParam(url, 'target')));
    }
    return agentError('TARGET_NOT_FOUND', 'Agent API route was not found.', 404);
}

async function handleSend(request: Request, agentId: string): Promise<Response> {
    let resolvedChatId: string | null = null;
    try {
        const input = agentSendRequestSchema.parse(await readJson(request));
        return json(
            sendAgentMessage(agentId, input, {
                onTargetResolved: (chatId) => {
                    resolvedChatId = chatId;
                },
            })
        );
    } catch (error) {
        if (
            error instanceof AgentApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            resolvedChatId
        ) {
            return agentError(
                error.code,
                error.message,
                error.status,
                error.nextAction,
                Boolean(readAgentDraft(agentId, resolvedChatId))
            );
        }
        throw error;
    }
}

function agentError(
    code: string,
    message: string,
    status: number,
    nextAction?: string,
    draftSaved?: boolean
) {
    return json(
        {
            code,
            message,
            ...(draftSaved === undefined ? {} : { draftSaved }),
            ...(nextAction ? { nextAction } : {}),
        },
        status
    );
}

function requiredParam(url: URL, name: string): string {
    const value = url.searchParams.get(name);
    if (!value) {
        throw new AgentApiError('INVALID_ARG', `${name} is required.`, 400);
    }
    return value;
}

function numberParam(url: URL, name: string): number | undefined {
    const value = url.searchParams.get(name);
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new AgentApiError('INVALID_ARG', `${name} is invalid.`, 400);
    }
    return parsed;
}

function booleanParam(url: URL, name: string): boolean | undefined {
    const value = url.searchParams.get(name);
    if (value === null) {
        return undefined;
    }
    if (value === '' || value === '1' || value === 'true') {
        return true;
    }
    if (value === '0' || value === 'false') {
        return false;
    }
    throw new AgentApiError('INVALID_ARG', `${name} must be true or false.`, 400);
}
