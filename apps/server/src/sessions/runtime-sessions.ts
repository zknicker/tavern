import type {
    AgentRuntimeSession,
    AgentRuntimeSessionMessage,
    AgentRuntimeSessionPreview,
} from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

export async function listRuntimeSessions(): Promise<AgentRuntimeSession[]> {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return [];
    }

    try {
        return (await client.listSessions()).sessions;
    } finally {
        client.close();
    }
}

export async function listRuntimeSessionMessagesForKeys(sessionKeys: string[]) {
    const client = createConfiguredAgentRuntimeClient();
    const messagesBySessionKey = new Map<string, AgentRuntimeSessionMessage[]>();

    if (!(client && sessionKeys.length > 0)) {
        return messagesBySessionKey;
    }

    try {
        const uniqueSessionKeys = [...new Set(sessionKeys)];
        const results = await Promise.all(
            uniqueSessionKeys.map(async (sessionKey) => ({
                messages: (await client.listSessionMessages(sessionKey)).messages,
                sessionKey,
            }))
        );

        for (const result of results) {
            messagesBySessionKey.set(result.sessionKey, result.messages);
        }

        return messagesBySessionKey;
    } finally {
        client.close();
    }
}

export async function listRuntimeSessionPreviewsForKeys(
    sessionKeys: string[],
    options: { limit?: number; maxChars?: number } = {}
) {
    const client = createConfiguredAgentRuntimeClient();
    const previewsBySessionKey = new Map<string, AgentRuntimeSessionPreview>();

    if (!(client && sessionKeys.length > 0)) {
        return previewsBySessionKey;
    }

    try {
        const uniqueSessionKeys = [...new Set(sessionKeys)];
        const result = await client.listSessionPreviews({
            keys: uniqueSessionKeys,
            limit: options.limit,
            maxChars: options.maxChars,
        });

        for (const preview of result.previews) {
            previewsBySessionKey.set(preview.key, preview);
        }

        return previewsBySessionKey;
    } finally {
        client.close();
    }
}
