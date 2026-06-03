import type { AgentRuntimeHighlightList } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';

export async function listHighlights(): Promise<AgentRuntimeHighlightList> {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return {
            freshness: {
                generatedAt: null,
                nextRefreshAt: null,
                staleReason: 'Tavern Runtime is not configured.',
                status: 'degraded',
            },
            highlights: [],
        };
    }

    try {
        return await client.listHighlights();
    } finally {
        client.close();
    }
}
