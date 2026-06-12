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
        'Use the wiki skill. Run the librarian scan from references/librarian.md across',
        'active topic wikis: score article staleness and quality and write',
        '.librarian/scan-results.json and REPORT.md. Then act on the findings in the',
        'same run, working only with material already on disk. Run lint --fix for',
        'mechanical repairs: broken links, missing See Also backlinks, stale indexes,',
        'and misplaced files. Recompile articles whose existing raw sources already',
        'hold newer uncompiled material, per references/compilation.md. File everything',
        'that needs outside material — re-fetching stale sources, research to thicken',
        'thin or single-source coverage, corroborating unverified claims, dedup merges',
        'needing judgment — as proposed todo records per references/todos.md;',
        'records are worked off automatically. Review blocked todo records — blocked',
        'is transient, not an archive: if the blocker has likely cleared, set the',
        'record back to proposed for a retry; otherwise resolve it into the wiki and',
        'delete it — write the failure state into the affected articles (lowered',
        'confidence, verified: false, a short note like "could not corroborate;',
        'source paywalled, checked 2026-06") so future scans see settled state',
        'instead of re-filing the work, then append a log.md todo entry recording',
        'the give-up. No record should stay blocked past roughly thirty days. Do',
        'not re-fetch external sources and do not rewrite article content beyond',
        'those failure-state marks in this run. If the hub has no active topic',
        'wikis, stop after a one-line summary. Finish with a one-line summary.',
    ].join(' ');
}
