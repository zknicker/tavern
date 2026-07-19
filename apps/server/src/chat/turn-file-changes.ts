import { TavernApiError } from '@tavern/sdk';
import { createTavernClientForConnection } from '../agent-runtime/drivers.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';

export interface ChatTurnFileChange {
    additions: number;
    afterSize: null | number;
    afterText: null | string;
    beforeSize: null | number;
    beforeText: null | string;
    change: 'created' | 'deleted' | 'modified';
    deletions: number;
    omitted: 'binary' | 'too-large' | null;
    path: string;
}

export interface ChatTurnFileChangeEvidence {
    capturedAt: string;
    changes: ChatTurnFileChange[];
    runId: string;
    truncated: boolean;
}

/**
 * Runtime-owned file-change evidence for one agent turn: the workspace files
 * the turn created, modified, or deleted, with bounded before/after text for
 * diff rendering. Null when no Runtime is connected or the turn recorded no
 * file changes.
 */
export async function getChatTurnFileChanges(
    runId: string
): Promise<ChatTurnFileChangeEvidence | null> {
    const connection = await getActiveAgentRuntimeConnection();
    if (!(connection?.enabled && connection.baseUrl)) {
        return null;
    }

    const client = createTavernClientForConnection(connection);
    try {
        const evidence = await client.chat.turnFileChanges(runId);
        return {
            capturedAt: evidence.captured_at,
            changes: evidence.changes.map((change) => ({
                additions: change.additions,
                afterSize: change.after_size,
                afterText: change.after_text,
                beforeSize: change.before_size,
                beforeText: change.before_text,
                change: change.change,
                deletions: change.deletions,
                omitted: change.omitted,
                path: change.path,
            })),
            runId: evidence.run_id,
            truncated: evidence.truncated,
        };
    } catch (error) {
        if (error instanceof TavernApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}
