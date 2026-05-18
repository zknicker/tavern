import type {
    AgentRuntimeModelAccessStatus,
    AgentRuntimeSaveClaudeCredential,
    AgentRuntimeSaveCodexCredential,
} from '@tavern/api';
import { z } from 'zod';
import {
    getTavernVaultSecret,
    saveTavernVaultSecret,
    tavernVaultSecretIds,
} from '../storage/tavern-vault.ts';

export const modelAccessIds = ['claude-code', 'codex'] as const;

export type ModelAccessId = (typeof modelAccessIds)[number];
export type ModelAccessStatus = AgentRuntimeModelAccessStatus;

const credentialSecretSchema = z.object({
    credential: z.string().trim().min(1),
});

function toStatus(input: {
    description: string;
    id: ModelAccessId;
    isConfigured: boolean;
}): ModelAccessStatus {
    return {
        description: input.description,
        id: input.id,
        source: input.isConfigured ? 'tavern-vault' : null,
        state: input.isConfigured ? 'live' : 'needs-auth',
    };
}

export async function listModelAccessStatuses(): Promise<ModelAccessStatus[]> {
    const [claudeCredential, codexCredential] = await Promise.all([
        getTavernVaultSecret({
            id: tavernVaultSecretIds.claudeCredential,
            schema: credentialSecretSchema,
        }),
        getTavernVaultSecret({
            id: tavernVaultSecretIds.codexCredential,
            schema: credentialSecretSchema,
        }),
    ]);

    return [
        toStatus({
            description: claudeCredential
                ? 'Claude Code credential is saved in Tavern Vault.'
                : 'Save a Claude Code credential in Tavern Vault.',
            id: 'claude-code',
            isConfigured: Boolean(claudeCredential),
        }),
        toStatus({
            description: codexCredential
                ? 'Codex credential is saved in Tavern Vault.'
                : 'Save a Codex credential in Tavern Vault.',
            id: 'codex',
            isConfigured: Boolean(codexCredential),
        }),
    ];
}

export async function saveClaudeCredential(
    input: AgentRuntimeSaveClaudeCredential
): Promise<ModelAccessStatus> {
    await saveTavernVaultSecret({
        id: tavernVaultSecretIds.claudeCredential,
        secret: {
            credential: input.credential,
        },
    });

    return toStatus({
        description: 'Claude Code credential is saved in Tavern Vault.',
        id: 'claude-code',
        isConfigured: true,
    });
}

export async function saveCodexCredential(
    input: AgentRuntimeSaveCodexCredential
): Promise<ModelAccessStatus> {
    await saveTavernVaultSecret({
        id: tavernVaultSecretIds.codexCredential,
        secret: {
            credential: input.credential,
        },
    });

    return toStatus({
        description: 'Codex credential is saved in Tavern Vault.',
        id: 'codex',
        isConfigured: true,
    });
}
