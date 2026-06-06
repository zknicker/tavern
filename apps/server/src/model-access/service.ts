import type { AgentRuntimeModelAccessStatus } from '@tavern/api';
import {
    CodexUsageParseError,
    decodeCodexAccessTokenMetadata,
    loadCodexCredentials,
} from '@tavern/codex-usage';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

export const modelAccessIds = ['codex', 'openai', 'openrouter'] as const;

export type ModelAccessId = (typeof modelAccessIds)[number];
export type ModelAccessStatus = AgentRuntimeModelAccessStatus;

function toStatus(input: {
    description: string;
    id: ModelAccessId;
    isConfigured: boolean;
    source?: string | null;
}): ModelAccessStatus {
    return {
        description: input.description,
        id: input.id,
        source: input.isConfigured ? (input.source ?? 'tavern-vault') : null,
        state: input.isConfigured ? 'live' : 'needs-auth',
    };
}

export async function listModelAccessStatuses(): Promise<ModelAccessStatus[]> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return [await readLocalCodexStatus()];
    }

    try {
        return (await client.getModelAccess()).providers;
    } finally {
        client.close();
    }
}

async function readLocalCodexStatus(): Promise<ModelAccessStatus> {
    try {
        const credentials = await loadCodexCredentials();
        const metadata = credentials
            ? decodeCodexAccessTokenMetadata(credentials.credentials.accessToken)
            : null;
        const label =
            metadata?.email ??
            credentials?.credentials.accountId ??
            credentials?.path ??
            '~/.codex/auth.json';

        return toStatus({
            description: credentials
                ? `Using Codex local auth for ${label}.`
                : 'Sign in with Codex to create ~/.codex/auth.json.',
            id: 'codex',
            isConfigured: Boolean(credentials),
            source: 'codex-auth-file',
        });
    } catch (error) {
        return {
            description:
                error instanceof CodexUsageParseError
                    ? 'Codex local auth is invalid. Sign in with Codex again.'
                    : 'Codex local auth could not be read.',
            id: 'codex',
            source: null,
            state: 'error',
        };
    }
}
