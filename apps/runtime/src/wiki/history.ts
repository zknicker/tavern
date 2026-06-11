import type { CortexHealthHistoryEntry } from '@tavern/api';
import { getDb } from '../db/connection';
import { type Database, namedParams } from '../db/sqlite';
import { listLatestLibrarianScans, listWikiEscalationPages } from './health';

const heartbeatMs = 24 * 60 * 60 * 1000;
const defaultHistoryLimit = 180;

interface HistoryRow {
    articles_scanned: null | number;
    avg_quality: null | number;
    avg_staleness: null | number;
    escalations_open: number;
    low_quality_count: null | number;
    recorded_at: string;
    scan_id: null | string;
    stale_count: null | number;
    topic: string;
}

/**
 * Appends one wiki health sample per topic when something changed — a new
 * librarian scan, a different open-escalation count — or as a daily heartbeat.
 * Derived, append-only, rebuildable: the wiki files stay the source of truth.
 */
export async function recordWikiHealthSamples(
    db: Database = getDb(),
    now: Date = new Date()
): Promise<number> {
    const [scans, escalationPages] = await Promise.all([
        listLatestLibrarianScans(),
        listWikiEscalationPages(),
    ]);

    const escalationsByTopic = new Map<string, number>();
    for (const page of escalationPages) {
        escalationsByTopic.set(page.topic, (escalationsByTopic.get(page.topic) ?? 0) + 1);
    }

    const topics = new Set<string>([
        ...scans.map((scan) => scan.topic),
        ...escalationsByTopic.keys(),
    ]);
    let recorded = 0;

    for (const topic of topics) {
        const scan = scans.find((entry) => entry.topic === topic) ?? null;
        const sample = {
            articlesScanned: scan?.articlesScanned ?? null,
            avgQuality: scan?.avgQuality ?? null,
            avgStaleness: scan?.avgStaleness ?? null,
            escalationsOpen: escalationsByTopic.get(topic) ?? 0,
            lowQualityCount: scan?.lowQualityCount ?? null,
            scanId: scan ? (scan.scanId ?? scan.completedAt ?? scan.updatedAt) : null,
            staleCount: scan?.staleCount ?? null,
            topic,
        };

        const last = db
            .prepare(
                `SELECT topic, scan_id, recorded_at, articles_scanned, stale_count,
                        low_quality_count, avg_staleness, avg_quality, escalations_open
                 FROM wiki_health_history
                 WHERE topic = $topic
                 ORDER BY recorded_at DESC, id DESC
                 LIMIT 1`
            )
            .get(namedParams({ topic })) as HistoryRow | null;

        const changed =
            !last ||
            last.scan_id !== sample.scanId ||
            last.escalations_open !== sample.escalationsOpen;
        const heartbeatDue = !last || now.getTime() - Date.parse(last.recorded_at) >= heartbeatMs;

        if (!(changed || heartbeatDue)) {
            continue;
        }

        db.prepare(
            `INSERT INTO wiki_health_history
             (topic, scan_id, recorded_at, articles_scanned, stale_count,
              low_quality_count, avg_staleness, avg_quality, escalations_open)
             VALUES ($topic, $scanId, $recordedAt, $articlesScanned, $staleCount,
              $lowQualityCount, $avgStaleness, $avgQuality, $escalationsOpen)`
        ).run(
            namedParams({
                articlesScanned: sample.articlesScanned,
                avgQuality: sample.avgQuality,
                avgStaleness: sample.avgStaleness,
                escalationsOpen: sample.escalationsOpen,
                lowQualityCount: sample.lowQualityCount,
                recordedAt: now.toISOString(),
                scanId: sample.scanId,
                staleCount: sample.staleCount,
                topic,
            })
        );
        recorded += 1;
    }

    return recorded;
}

export function listWikiHealthHistory(
    db: Database = getDb(),
    options: { limit?: number } = {}
): CortexHealthHistoryEntry[] {
    const limit = options.limit ?? defaultHistoryLimit;
    const rows = db
        .prepare(
            `SELECT topic, scan_id, recorded_at, articles_scanned, stale_count,
                    low_quality_count, avg_staleness, avg_quality, escalations_open
             FROM (
               SELECT *
               FROM wiki_health_history
               ORDER BY recorded_at DESC, id DESC
               LIMIT $limit
             )
             ORDER BY recorded_at ASC, id ASC`
        )
        .all(namedParams({ limit })) as HistoryRow[];

    return rows.map((row) => ({
        articlesScanned: row.articles_scanned,
        avgQuality: row.avg_quality,
        avgStaleness: row.avg_staleness,
        escalationsOpen: row.escalations_open,
        lowQualityCount: row.low_quality_count,
        recordedAt: row.recorded_at,
        scanId: row.scan_id,
        staleCount: row.stale_count,
        topic: row.topic,
    }));
}
