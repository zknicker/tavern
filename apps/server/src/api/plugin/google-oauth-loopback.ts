import http from 'node:http';
import type { AgentRuntimeGoogleOAuthStart } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../../agent-runtime/client.ts';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';

interface GoogleOAuthLoopbackSession {
    server: http.Server;
    timeout: ReturnType<typeof setTimeout>;
}

type RuntimeClientFactory = () => TavernAgentRuntimeClient | null;

const loopbackSessions = new Map<string, GoogleOAuthLoopbackSession>();

export async function startGoogleOAuthLoopback(
    client: TavernAgentRuntimeClient,
    createRuntimeClient: RuntimeClientFactory = createConfiguredAgentRuntimeClient
): Promise<AgentRuntimeGoogleOAuthStart> {
    const server = http.createServer();

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!(address && typeof address === 'object')) {
        server.close();
        throw new Error('Google OAuth callback server did not start.');
    }

    const redirectUri = `http://127.0.0.1:${address.port}/callback`;
    try {
        const session = await client.startGoogleOAuth({ redirectUri });
        const timeout = setTimeout(
            () => closeGoogleOAuthLoopback(session.sessionId),
            ttlMs(session)
        );
        loopbackSessions.set(session.sessionId, { server, timeout });
        server.on('request', (request, response) => {
            void handleGoogleOAuthLoopbackCallback(
                session.sessionId,
                request,
                response,
                createRuntimeClient
            );
        });
        return session;
    } catch (error) {
        server.close();
        throw error;
    }
}

export function closeGoogleOAuthLoopback(sessionId: string) {
    const session = loopbackSessions.get(sessionId);
    if (!session) {
        return;
    }
    loopbackSessions.delete(sessionId);
    clearTimeout(session.timeout);
    session.server.close();
}

async function handleGoogleOAuthLoopbackCallback(
    sessionId: string,
    request: http.IncomingMessage,
    response: http.ServerResponse,
    createRuntimeClient: RuntimeClientFactory
) {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
        response.writeHead(404).end('Not found');
        return;
    }

    try {
        const client = createRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }
        try {
            const result = await client.completeGoogleOAuth(sessionId, {
                code: url.searchParams.get('code') ?? undefined,
                error: url.searchParams.get('error') ?? undefined,
                state: url.searchParams.get('state') ?? '',
            });
            if (result.status !== 'approved') {
                throw new Error(result.errorMessage ?? 'Google connection failed.');
            }
        } finally {
            client.close();
        }

        response
            .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
            .end('<h1>Google connected</h1><p>You can close this window and return to Grotto.</p>');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        response
            .writeHead(400, { 'content-type': 'text/html; charset=utf-8' })
            .end(
                [
                    '<h1>Google connection failed</h1>',
                    '<p>Return to Grotto and try again.</p>',
                    `<pre>${escapeHtml(message)}</pre>`,
                ].join('')
            );
    } finally {
        closeGoogleOAuthLoopback(sessionId);
    }
}

function ttlMs(session: AgentRuntimeGoogleOAuthStart) {
    const ttl = Date.parse(session.expiresAt) - Date.now();
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 0;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
