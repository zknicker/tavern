import type { CortexDatabase } from './db';
import { refreshDerivedPageState } from './derive';
import { detectCortexIssues } from './lint';
import type { PageRow } from './rows';

export interface CortexRepairDerivedStateResult {
    afterIssueCount: number;
    beforeIssueCount: number;
    dryRun: boolean;
    pagesRepaired: number;
    summary: string;
}

export async function runCortexRepairDerivedState(
    db: CortexDatabase,
    input: { dryRun?: boolean; now: string }
): Promise<CortexRepairDerivedStateResult> {
    const before = await detectCortexIssues(db);
    const pages = await listPages(db);
    const dryRun = input.dryRun ?? false;
    if (dryRun) {
        return {
            afterIssueCount: before.length,
            beforeIssueCount: before.length,
            dryRun,
            pagesRepaired: 0,
            summary: `Dry run: would repair derived Cortex links and chunks for ${pages.length} page(s); current issues ${before.length}.`,
        };
    }

    for (const page of pages) {
        await refreshDerivedPageState(db, page, input.now);
    }
    await cleanOrphanDerivedRows(db);
    const after = await detectCortexIssues(db);
    return {
        afterIssueCount: after.length,
        beforeIssueCount: before.length,
        dryRun,
        pagesRepaired: pages.length,
        summary: `Repaired derived Cortex links and chunks for ${pages.length} page(s); issues ${before.length} -> ${after.length}.`,
    };
}

async function cleanOrphanDerivedRows(db: CortexDatabase): Promise<void> {
    await db
        .prepare(
            `DELETE FROM cortex_links
             WHERE from_page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
        )
        .run();
    await db
        .prepare(
            `DELETE FROM cortex_chunks
             WHERE page_id IS NOT NULL
               AND page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
        )
        .run();
    await db
        .prepare(
            `DELETE FROM cortex_timeline_entries
             WHERE page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
        )
        .run();
}

async function listPages(db: CortexDatabase): Promise<PageRow[]> {
    return await db.prepare('SELECT * FROM cortex_pages WHERE deleted_at IS NULL').all<PageRow>();
}
