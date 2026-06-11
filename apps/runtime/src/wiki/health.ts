import fs from 'node:fs/promises';
import path from 'node:path';
import type { CortexHealth, CortexLibrarianScan, CortexMaintenanceRun } from '@tavern/api';
import { getRuntimeJobScheduleNextRunAt } from '../jobs/manager';
import { getWikiCompileStatus } from './compile-run';
import { listWikiHealthHistory } from './history';
import { getWikiLibrarianStatus } from './librarian-run';
import { getCortexStatus, listCortexTopics } from './store';
import { getWikiTodoProcessing, todoDrainCooldownMs } from './todo-drain';
import { listWikiTodoCompletions, listWikiTodos, nextDrainableTodo } from './todos';

/**
 * Health rollup for the Cortex tab: derived purely from facts — hub access,
 * todos (follow-up records), latest librarian scans, and pipeline run state.
 * The wiki files stay the source of truth; this is a projection.
 */
export async function getCortexHealth(): Promise<CortexHealth> {
    const status = await getCortexStatus();
    const [todos, scans, todoCompletions] = await Promise.all([
        status.readable ? listWikiTodos() : Promise.resolve([]),
        status.readable ? listLatestLibrarianScans() : Promise.resolve([]),
        status.readable ? listWikiTodoCompletions() : Promise.resolve([]),
    ]);
    const todoProcessing = await resolveTodoProcessing(todos);

    return {
        history: listWikiHealthHistory(),
        runs: await listWikiMaintenanceRuns(todoProcessing),
        scans,
        state: status.readable ? 'healthy' : 'degraded',
        status,
        todoCompletions,
        todoProcessing,
        todos,
    };
}

/**
 * One tile per pipeline stage. Compile and todos are condition-driven — their
 * timestamps mark the last real agent run, not the last check — while the
 * librarian carries the next scheduled pass.
 */
async function listWikiMaintenanceRuns(
    todoProcessing: Awaited<ReturnType<typeof resolveTodoProcessing>>
): Promise<CortexMaintenanceRun[]> {
    const compile = getWikiCompileStatus();
    const librarian = getWikiLibrarianStatus();
    const librarianNextRunAt = await getRuntimeJobScheduleNextRunAt('wiki-librarian').catch(
        () => null
    );

    return [
        {
            lastRunAtMs: compile.lastRunAtMs,
            name: 'Compile',
            nextRunAtMs: null,
            running: compile.running,
        },
        {
            lastRunAtMs: librarian.lastRunAtMs,
            name: 'Librarian',
            nextRunAtMs: librarianNextRunAt ? Date.parse(librarianNextRunAt) : null,
            running: librarian.running,
        },
        {
            lastRunAtMs: todoProcessing.lastRunAtMs,
            name: 'Todos',
            nextRunAtMs: todoProcessing.nextRunAtMs,
            running: todoProcessing.runningPath !== null,
        },
    ];
}

async function resolveTodoProcessing(todos: Awaited<ReturnType<typeof listWikiTodos>>) {
    const processing = getWikiTodoProcessing();
    if (processing.runningPath || !nextDrainableTodo(todos)) {
        return processing;
    }
    const jobNextRunAt = await getRuntimeJobScheduleNextRunAt('wiki-todo-drain').catch(() => null);
    const jobNextRunAtMs = jobNextRunAt ? Date.parse(jobNextRunAt) : null;
    const cooldownEndsAtMs =
        processing.lastRunAtMs === null ? null : processing.lastRunAtMs + todoDrainCooldownMs;
    const nextRunAtMs = Math.max(jobNextRunAtMs ?? 0, cooldownEndsAtMs ?? 0) || null;
    return { ...processing, nextRunAtMs };
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

function readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
