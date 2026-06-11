import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

export interface WikiAgentClient {
    streamChat(input: {
        content: string;
        sessionKey: string;
        title?: null | string;
    }): AsyncIterable<{ data?: unknown; event: string }>;
}

const activeRuns = new Set<string>();

/**
 * Runs one wiki maintenance agent turn directly through the gateway — no cron.
 * The caller owns the condition and cadence; this owns the turn and the
 * running flag the health surface reads.
 */
export async function runWikiAgentTurn(
    client: WikiAgentClient,
    input: { content: string; runName: string; sessionKey: string; title: string }
): Promise<null | string> {
    activeRuns.add(input.runName);
    try {
        let summary: null | string = null;
        for await (const event of client.streamChat({
            content: input.content,
            sessionKey: input.sessionKey,
            title: input.title,
        })) {
            if (event.event === 'assistant.completed') {
                summary = readCompletedContent(event.data);
            }
        }
        return summary;
    } finally {
        activeRuns.delete(input.runName);
    }
}

export function isWikiRunActive(runName: string): boolean {
    return activeRuns.has(runName);
}

export function readWikiRunTimestamp(db: Database, key: string): null | number {
    const row = db
        .prepare('SELECT value FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key })) as { value: string } | null;
    if (!row) {
        return null;
    }
    const parsed = Date.parse(row.value);
    return Number.isNaN(parsed) ? null : parsed;
}

export function writeWikiRunTimestamp(db: Database, key: string, nowMs: number): void {
    const timestamp = new Date(nowMs).toISOString();
    db.prepare(
        `INSERT INTO runtime_metadata (key, value, updated_at)
         VALUES ($key, $value, $updatedAt)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at`
    ).run(namedParams({ key, updatedAt: timestamp, value: timestamp }));
}

function readCompletedContent(data: unknown): null | string {
    if (!data || typeof data !== 'object') {
        return null;
    }
    const content = (data as { content?: unknown }).content;
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    const firstLine = content.trim().split('\n', 1)[0] ?? '';
    return firstLine.slice(0, 300) || null;
}
