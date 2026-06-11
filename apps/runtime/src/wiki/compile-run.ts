import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import {
    isWikiRunActive,
    readWikiRunTimestamp,
    runWikiAgentTurn,
    type WikiAgentClient,
    writeWikiRunTimestamp,
} from './agent-run';
import { isCompileDue, listPendingCompileTopics } from './compile-pending';

export const wikiCompileRunName = 'compile';
export const wikiCompileCooldownMs = 60 * 60 * 1000;
const lastCompileKey = 'wiki_compile_last_run_at';
const compileSessionKey = 'tavern-wiki-compile';

export type WikiCompileOutcome =
    | { kind: 'compiled'; summary: null | string; topics: string[] }
    | { kind: 'cooling'; nextAtMs: number }
    | { kind: 'idle' };

/**
 * The compile stage of the wiki pipeline: when enough sources are pending —
 * or one has waited long enough — run one agent turn that compiles them into
 * articles. Detection is pure filesystem work; the agent only runs when there
 * is real compile work.
 */
export async function runWikiCompile(
    client: WikiAgentClient,
    db: Database = getDb(),
    nowMs: number = Date.now()
): Promise<WikiCompileOutcome> {
    const pending = await listPendingCompileTopics();
    const topics = pending
        .filter((topic) => isCompileDue(topic, nowMs))
        .map((topic) => topic.topic);
    if (topics.length === 0) {
        return { kind: 'idle' };
    }

    const lastRunAtMs = readWikiRunTimestamp(db, lastCompileKey);
    if (lastRunAtMs !== null && nowMs - lastRunAtMs < wikiCompileCooldownMs) {
        return { kind: 'cooling', nextAtMs: lastRunAtMs + wikiCompileCooldownMs };
    }

    const summary = await runWikiAgentTurn(client, {
        content: buildWikiCompilePrompt(topics),
        runName: wikiCompileRunName,
        sessionKey: compileSessionKey,
        title: 'Cortex compile',
    });
    writeWikiRunTimestamp(db, lastCompileKey, nowMs);
    return { kind: 'compiled', summary, topics };
}

export function getWikiCompileStatus(db: Database = getDb()) {
    return {
        lastRunAtMs: readWikiRunTimestamp(db, lastCompileKey),
        running: isWikiRunActive(wikiCompileRunName),
    };
}

export function buildWikiCompilePrompt(topics: string[]): string {
    return [
        `Use the wiki skill. These topic wikis have uncompiled raw sources: ${topics.join(', ')}.`,
        'Compile the new sources into wiki articles per the incremental compile workflow',
        'in references/compilation.md: synthesize rather than copy, add bidirectional',
        'See Also dual-links, update the affected _index.md files, and append a log.md',
        'entry per wiki changed. Finish with a quick structural pass over the wikis you',
        'changed: repair any indexes, links, or backlinks your edits affected, and',
        're-score changed articles in .librarian/scan-results.json per',
        'references/librarian.md where entries exist. Work only with material already',
        'on disk. If you notice work that needs new research, external fetches, or',
        'article rewrites — unverified claims, thin or single-source coverage, dedup',
        'candidates, promising sources to ingest — file it as a proposed inventory',
        'record per references/inventory.md instead of doing it now; records are worked',
        'off automatically. Finish with a one-line summary.',
    ].join(' ');
}
