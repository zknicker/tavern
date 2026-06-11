import {
    type AgentRuntimeCreateCron,
    type AgentRuntimeCron,
    type AgentRuntimeCronList,
    type AgentRuntimeUpdateCron,
    isTavernManagedCronName,
} from '@tavern/api';
import { listCortexTopics } from '../wiki/store';

export interface ManagedCronDefinition {
    description: string;
    name: string;
    prompt: string;
    schedule: AgentRuntimeCron['schedule'];
}

export const wikiUpkeepCronName = 'Tavern: Wiki upkeep';

/**
 * Default wiki maintenance crons, following the cadence llm-wiki prescribes:
 * incremental compile keeps new sources flowing into articles, lint repairs
 * structure and bidirectional links, and the librarian scores staleness and
 * quality without touching content.
 */
export const managedCronDefinitions: ManagedCronDefinition[] = [
    {
        description: 'Daily upkeep: compiles new wiki sources into articles.',
        name: wikiUpkeepCronName,
        prompt: [
            'Use the wiki skill. For each active topic wiki in the hub (skip archived topics),',
            'check for raw sources that are not yet compiled, per the incremental compile',
            'workflow in references/compilation.md. Compile any new sources into wiki',
            'articles: synthesize rather than copy, add bidirectional See Also dual-links,',
            'update the affected _index.md files, and append a log.md entry per wiki changed.',
            'Finish with a quick structural pass over the wikis you changed: repair any',
            'indexes, links, or backlinks your edits affected. If there are no uncompiled',
            'sources, stop after a one-line summary.',
        ].join(' '),
        schedule: { expr: '30 4 * * *', kind: 'cron' },
    },
    {
        description: 'Weekly structural health pass: repairs wiki indexes, links, and backlinks.',
        name: 'Tavern: Wiki lint',
        prompt: [
            'Use the wiki skill. For each active topic wiki in the hub (skip archived topics),',
            'run the lint --fix workflow from references/linting.md: repair structure,',
            'frontmatter, stale indexes, broken links, and missing bidirectional See Also',
            'backlinks, and append a log.md entry per wiki you change. If the hub has no',
            'active topic wikis, stop after a one-line summary. Finish with a short report of',
            'fixes applied and any warnings that need human review.',
        ].join(' '),
        schedule: { expr: '0 5 * * 1', kind: 'cron' },
    },
    {
        description:
            'Weekly librarian pass: scores articles, repairs what is safe, files the rest as inventory.',
        name: 'Tavern: Wiki librarian',
        prompt: [
            'Use the wiki skill. Run the librarian scan from references/librarian.md across',
            'active topic wikis: score article staleness and quality and write',
            '.librarian/scan-results.json and REPORT.md. Then act on the findings in the',
            'same run through sanctioned workflows. Run lint --fix for mechanical repairs:',
            'broken links, missing See Also backlinks, stale indexes, and misplaced files.',
            'Recompile articles whose existing raw sources already hold newer uncompiled',
            'material, per references/compilation.md. Record the remaining judgment items —',
            'unverified or low-confidence claims, thin or single-source coverage that needs',
            'research, and dedup candidates — as proposed inventory records per',
            'references/inventory.md; they are worked off automatically. Escalate to the',
            'user only as a last resort, when no autonomous workflow can resolve a record:',
            'claim verification, retraction calls, or paid or private access. Escalate by',
            'setting owner: user and a next_action written as one short, direct question the',
            'user can answer in a sentence. Do not re-fetch external sources and do not',
            'rewrite article content based on staleness scores alone. If the hub has no',
            'active topic wikis, stop after a one-line summary.',
        ].join(' '),
        schedule: { expr: '0 6 * * 6', kind: 'cron' },
    },
];

export interface ManagedCronClient {
    createCronJob(input: AgentRuntimeCreateCron): Promise<AgentRuntimeCron>;
    deleteCronJob(jobId: string): Promise<{ archived: true; id: string }>;
    getCronJob(jobId: string): Promise<AgentRuntimeCron>;
    listCronJobs(): Promise<AgentRuntimeCronList>;
    updateCronJob(jobId: string, input: AgentRuntimeUpdateCron): Promise<AgentRuntimeCron>;
}

export interface ManagedCronSyncResult {
    created: string[];
    removed: string[];
    skippedReason: 'no-active-topics' | null;
    updated: string[];
}

/**
 * Reconciles the managed cron set in Hermes: creates missing defaults, repairs
 * schedule or prompt drift, and removes retired Tavern-managed jobs. User
 * pause/resume state is preserved; creation waits until the wiki hub has at
 * least one active topic so empty hubs do not burn scheduled agent turns.
 */
export async function syncManagedCrons(client: ManagedCronClient): Promise<ManagedCronSyncResult> {
    const result: ManagedCronSyncResult = {
        created: [],
        removed: [],
        skippedReason: null,
        updated: [],
    };
    const { jobs } = await client.listCronJobs();
    const managedJobs = jobs.filter((job) => isTavernManagedCronName(job.name));
    const definitionNames = new Set(managedCronDefinitions.map((definition) => definition.name));

    for (const job of managedJobs) {
        if (!definitionNames.has(job.name)) {
            await client.deleteCronJob(job.id);
            result.removed.push(job.name);
        }
    }

    const hasActiveTopics = (await listCortexTopics()).topics.length > 0;
    if (!hasActiveTopics && managedJobs.every((job) => !definitionNames.has(job.name))) {
        result.skippedReason = 'no-active-topics';
        return result;
    }

    for (const definition of managedCronDefinitions) {
        const existing = managedJobs.find((job) => job.name === definition.name);
        if (!existing) {
            if (!hasActiveTopics) {
                continue;
            }
            await client.createCronJob({
                delivery: null,
                description: definition.description,
                enabled: true,
                id: definition.name,
                name: definition.name,
                payload: { kind: 'agentTurn', message: definition.prompt },
                schedule: definition.schedule,
                wakeMode: 'now',
            });
            result.created.push(definition.name);
            continue;
        }

        const job = await client.getCronJob(existing.id);
        const prompt = job.payload.kind === 'agentTurn' ? job.payload.message : null;
        const drifted =
            prompt !== definition.prompt ||
            scheduleText(job.schedule) !== scheduleText(definition.schedule);
        if (drifted) {
            await client.updateCronJob(job.id, {
                payload: { kind: 'agentTurn', message: definition.prompt },
                schedule: definition.schedule,
            });
            result.updated.push(definition.name);
        }
    }

    return result;
}

function scheduleText(schedule: AgentRuntimeCron['schedule']) {
    if (schedule.kind === 'at') {
        return schedule.at;
    }
    if (schedule.kind === 'cron') {
        return schedule.expr;
    }
    return `every ${Math.max(1, Math.round(schedule.everyMs / 60_000))}m`;
}
