import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import {
    isWikiRunActive,
    readWikiRunTimestamp,
    runWikiAgentTurn,
    type WikiAgentClient,
    writeWikiRunTimestamp,
} from './agent-run';
import { listCortexTopics } from './store';

export const wikiLibrarianRunName = 'librarian';
const lastLibrarianKey = 'wiki_librarian_last_run_at';
const librarianSessionKey = 'tavern-wiki-librarian';

export type WikiLibrarianOutcome =
    | { kind: 'no-topics' }
    | { kind: 'scanned'; summary: null | string };

/**
 * The weekly librarian pass: score every article, repair what is mechanical,
 * and file everything needing outside material as todos for the drain.
 */
export async function runWikiLibrarian(
    client: WikiAgentClient,
    db: Database = getDb(),
    nowMs: number = Date.now()
): Promise<WikiLibrarianOutcome> {
    const { topics } = await listCortexTopics();
    if (topics.length === 0) {
        return { kind: 'no-topics' };
    }

    const summary = await runWikiAgentTurn(client, {
        content: buildWikiLibrarianPrompt(),
        runName: wikiLibrarianRunName,
        sessionKey: librarianSessionKey,
        title: 'Cortex librarian',
    });
    writeWikiRunTimestamp(db, lastLibrarianKey, nowMs);
    return { kind: 'scanned', summary };
}

export function getWikiLibrarianStatus(db: Database = getDb()) {
    return {
        lastRunAtMs: readWikiRunTimestamp(db, lastLibrarianKey),
        running: isWikiRunActive(wikiLibrarianRunName),
    };
}

export function buildWikiLibrarianPrompt(): string {
    return [
        'Use the cortex-wiki skill. You are an unattended maintenance run: the confirmation, preview, and delegation steps in the references do not apply — score, then act, in this same run.',
        'Run the librarian scan from references/librarian.md across active topic wikis: score article staleness and quality and write .librarian/scan-results.json and REPORT.md.',
        'Act on the findings, working only with material already on disk. Run lint --fix for mechanical repairs: broken links, missing See Also backlinks, stale indexes, and misplaced files.',
        'Recompile articles whose existing raw sources already hold newer uncompiled material, per references/compilation.md.',
        'Flag source-shaped or overview-only topics per references/topic-planning.md and lint rule C20; file proposed consolidation todos instead of moving or merging topics during this run.',
        'File everything that needs outside material — re-fetching stale sources, research to thicken thin or single-source coverage, corroborating unverified claims, dedup merges needing judgment — as proposed todo records per references/todos.md.',
        'Review blocked todo records — blocked is transient: set records whose blocker has likely cleared back to proposed; resolve the rest into the wiki and delete them, writing the failure state into the affected articles (lowered confidence, verified: false, a short dated note) and appending a log.md todo entry recording the give-up. No record stays blocked past roughly thirty days.',
        'Beyond those recompiles and failure-state marks, do not rewrite article content, and do not fetch external sources.',
        'If the hub has no active topic wikis, stop. Finish with a one-line summary.',
    ].join('\n');
}
