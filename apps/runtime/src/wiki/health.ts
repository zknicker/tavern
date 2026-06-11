import type {
    CortexEscalation,
    CortexHealth,
    CortexLibrarianReport,
    CortexManagedRun,
    CortexPage,
} from '@tavern/api';
import { createLocalHermesClient } from '../hermes/local-client';
import { getCortexPage, getCortexStatus, listCortexPages, listCortexTopics } from './store';

/**
 * Health rollup for the Cortex tab: derived purely from facts — hub access,
 * escalation records, latest librarian reports, and managed cron run state.
 * The wiki files stay the source of truth; this is a read-only projection.
 */
export async function getCortexHealth(): Promise<CortexHealth> {
    const status = await getCortexStatus();
    const [escalationPages, reports, runs] = await Promise.all([
        status.readable ? listWikiEscalationPages() : Promise.resolve([]),
        status.readable ? listLatestLibrarianReports() : Promise.resolve([]),
        listManagedWikiRuns(),
    ]);
    const escalations = escalationPages.map(toEscalation);

    return {
        escalations,
        reports,
        runs,
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

async function listLatestLibrarianReports(): Promise<CortexLibrarianReport[]> {
    const { topics } = await listCortexTopics();
    const reports = await Promise.all(
        topics.map(async (topic) => {
            const page = await getCortexPage({
                path: '.librarian/REPORT.md',
                topic: topic.slug,
            });
            return page ? { body: page.body, topic: topic.slug, updatedAt: page.updatedAt } : null;
        })
    );
    return reports.filter((report): report is CortexLibrarianReport => Boolean(report));
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
