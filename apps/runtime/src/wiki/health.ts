import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    CortexEscalation,
    CortexHealth,
    CortexLibrarianScan,
    CortexManagedRun,
    CortexPage,
} from '@tavern/api';
import { createLocalHermesClient } from '../hermes/local-client';
import { listWikiHealthHistory } from './history';
import { getCortexPage, getCortexStatus, listCortexPages, listCortexTopics } from './store';

/**
 * Health rollup for the Cortex tab: derived purely from facts — hub access,
 * escalation records, latest librarian scans, and managed cron run state.
 * The wiki files stay the source of truth; this is a read-only projection.
 */
export async function getCortexHealth(): Promise<CortexHealth> {
    const status = await getCortexStatus();
    const [escalationPages, scans, runs] = await Promise.all([
        status.readable ? listWikiEscalationPages() : Promise.resolve([]),
        status.readable ? listLatestLibrarianScans() : Promise.resolve([]),
        listManagedWikiRuns(),
    ]);
    const escalations = escalationPages.map(toEscalation);

    return {
        escalations,
        history: listWikiHealthHistory(),
        runs,
        scans,
        state: status.readable
            ? escalations.length > 0
                ? 'needs_attention'
                : 'healthy'
            : 'degraded',
        status,
    };
}

/**
 * Inventory records parked on the user — llm-wiki convention `status:
 * proposed` plus `owner: user`. The managed wiki crons escalate this way only
 * as a last resort.
 */
export async function listWikiEscalationPages(): Promise<CortexPage[]> {
    try {
        const { pages } = await listCortexPages({});
        const inventoryPages = pages.filter((page) => page.section === 'inventory');
        const details = await Promise.all(
            inventoryPages.map((page) => getCortexPage({ path: page.path, topic: page.topic }))
        );
        return details.filter(
            (page): page is NonNullable<typeof page> =>
                Boolean(page) &&
                readFrontmatterValue(page?.frontmatter.status) === 'proposed' &&
                readFrontmatterValue(page?.frontmatter.owner) === 'user'
        );
    } catch {
        return [];
    }
}

function toEscalation(page: CortexPage): CortexEscalation {
    return {
        path: page.path,
        priority: readString(page.frontmatter.priority),
        question: readString(page.frontmatter.next_action) ?? readString(page.frontmatter.summary),
        title: page.title,
        topic: page.topic,
        updatedAt: page.updatedAt,
    };
}

/**
 * Reads `.librarian/scan-results.json` per topic — llm-wiki's machine-readable
 * scan output ("REPORT.md is rendered from it"). Agent-written JSON is parsed
 * defensively: missing fields become null, unparseable files are skipped.
 */
export async function listLatestLibrarianScans(): Promise<CortexLibrarianScan[]> {
    const { topics } = await listCortexTopics();
    const scans = await Promise.all(
        topics.map(async (topic) => {
            const filePath = path.join(topic.path, '.librarian', 'scan-results.json');
            try {
                const [content, stat] = await Promise.all([
                    fs.readFile(filePath, 'utf8'),
                    fs.stat(filePath),
                ]);
                return toLibrarianScan(topic.slug, stat.mtime.toISOString(), JSON.parse(content));
            } catch {
                return null;
            }
        })
    );
    return scans.filter((scan): scan is CortexLibrarianScan => Boolean(scan));
}

function toLibrarianScan(topic: string, updatedAt: string, value: unknown): CortexLibrarianScan {
    const record = isRecord(value) ? value : {};
    const summary = isRecord(record.summary) ? record.summary : {};
    const articles = isRecord(record.articles) ? record.articles : {};

    return {
        articles: Object.entries(articles)
            .map(([articlePath, scores]) => toLibrarianArticle(articlePath, scores))
            .sort((left, right) => worstScore(left) - worstScore(right)),
        articlesScanned: readNumber(summary.articles_scanned),
        avgQuality: readNumber(summary.avg_quality),
        avgStaleness: readNumber(summary.avg_staleness),
        completedAt: readString(record.completed_at),
        lowQualityCount: readNumber(summary.low_quality_count),
        scanId: readString(record.scan_id),
        staleCount: readNumber(summary.stale_count),
        threshold: readNumber(record.threshold),
        topic,
        updatedAt,
    };
}

function toLibrarianArticle(articlePath: string, value: unknown) {
    const record = isRecord(value) ? value : {};
    const staleness = isRecord(record.staleness) ? record.staleness : {};
    const quality = isRecord(record.quality) ? record.quality : {};
    return {
        path: articlePath,
        qualityFlags: Array.isArray(quality.flags)
            ? quality.flags.filter((flag): flag is string => typeof flag === 'string')
            : [],
        qualityScore: readNumber(quality.score),
        stalenessScore: readNumber(staleness.score),
    };
}

function worstScore(article: { qualityScore: null | number; stalenessScore: null | number }) {
    return Math.min(article.stalenessScore ?? 100, article.qualityScore ?? 100);
}

async function listManagedWikiRuns(): Promise<CortexManagedRun[]> {
    const client = createLocalHermesClient();
    try {
        const { jobs } = await client.listCronJobs();
        return jobs
            .filter((job) => job.managed)
            .map((job) => ({
                enabled: job.enabled,
                lastRunAtMs: job.state.lastRunAtMs ?? null,
                lastRunStatus: job.state.lastRunStatus ?? null,
                name: job.name,
                nextRunAtMs: job.state.nextRunAtMs ?? null,
            }))
            .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
        return [];
    } finally {
        client.close();
    }
}

function readFrontmatterValue(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
