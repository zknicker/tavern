import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getCurrentSessionToken } from '../identity/session-token-store.ts';
import { parseAgentRuntimeConnectionAuth } from './auth.ts';

type RuntimeClientFactory = typeof createAgentRuntimeClientForConnection;

export async function checkAgentRuntimeConnection(
    input: { auth?: unknown; baseUrl: string },
    createClient: RuntimeClientFactory = createAgentRuntimeClientForConnection
) {
    const auth = input.auth ? parseAgentRuntimeConnectionAuth(input.auth) : null;
    return await checkAgentRuntimeCapabilities(
        {
            authJson: auth ? JSON.stringify(auth) : null,
            baseUrl: input.baseUrl,
        },
        createClient
    );
}

export async function checkAgentRuntimeCapabilities(
    input: { authJson?: null | string; baseUrl: string },
    createClient: RuntimeClientFactory = createAgentRuntimeClientForConnection
) {
    try {
        const capabilities = await probeAgentRuntime(input, createClient);
        return { baseUrl: input.baseUrl, capabilities };
    } catch (error) {
        const secureBaseUrl = toSecureRuntimeUrl(input.baseUrl);
        if (!secureBaseUrl) {
            throw error;
        }

        const capabilities = await probeAgentRuntime(
            { ...input, baseUrl: secureBaseUrl },
            createClient
        );
        return { baseUrl: secureBaseUrl, capabilities };
    }
}

async function probeAgentRuntime(
    input: { authJson?: null | string; baseUrl: string },
    createClient: RuntimeClientFactory
) {
    const auth = parseAgentRuntimeConnectionAuth(input.authJson);
    const client = createClient(input);

    try {
        const capabilities = await client.listCapabilities();
        if (auth?.kind === 'clerk-session') {
            const token = getCurrentSessionToken();
            if (!token) {
                throw new Error(
                    'No active user session is available for this Grotto Runtime connection.'
                );
            }
            const identity = await client.getIdentityMe(token);
            if (identity.role === null) {
                throw new Error('The signed-in user is not a member of this Grotto Runtime.');
            }
        }
        return capabilities;
    } finally {
        client.close();
    }
}

function toSecureRuntimeUrl(baseUrl: string) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:') {
        return null;
    }

    url.protocol = 'https:';
    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}
