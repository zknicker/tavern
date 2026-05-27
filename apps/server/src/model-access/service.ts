import type { AgentRuntimeModelAccessStatus } from '@tavern/api';
import {
    CodexUsageParseError,
    decodeCodexAccessTokenMetadata,
    loadCodexCredentials,
} from '@tavern/codex-usage';

export const modelAccessIds = ['codex'] as const;

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
    let codexCredential: Awaited<ReturnType<typeof loadCodexCredentials>>;

    try {
        codexCredential = await loadCodexCredentials();
    } catch (error) {
        return [
            {
                description:
                    error instanceof CodexUsageParseError
                        ? 'Codex local auth is invalid. Sign in with Codex again.'
                        : 'Codex local auth could not be read.',
                id: 'codex',
                source: null,
                state: 'error',
            },
        ];
    }

    const codexMetadata = codexCredential
        ? decodeCodexAccessTokenMetadata(codexCredential.credentials.accessToken)
        : null;
    const codexLabel =
        codexMetadata?.email ??
        codexCredential?.credentials.accountId ??
        codexCredential?.path ??
        '~/.codex/auth.json';

    return [
        toStatus({
            description: codexCredential
                ? `Using Codex local auth for ${codexLabel}.`
                : 'Sign in with Codex to create ~/.codex/auth.json.',
            id: 'codex',
            isConfigured: Boolean(codexCredential),
            source: 'codex-auth-file',
        }),
    ];
}
