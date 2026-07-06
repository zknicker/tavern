import fs from 'node:fs/promises';
import path from 'node:path';
import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import { AGENT_WORKSPACE } from '../config';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { demoAgentId } from './development-chat-demo-types';
import { shouldSeedDevelopmentChatDemos } from './development-chat-demos';

/**
 * Seed realistic Memory worker history for the dev stack, mirroring the
 * seeded #demo chat: completed/skipped/failed captures, a failed and a
 * completed dream, plus the backing episodic Markdown in the agent workspace.
 *
 * Safety: the completed dream is always the newest completed job, so dream
 * eligibility sees zero new extractions and never queues a real model call
 * from seeded data.
 */

const hourMs = 60 * 60 * 1000;
const demoModelJson = JSON.stringify({ model: 'gpt-4.1-mini', provider: 'openai' });

const captureObservationsEarly = [
    '- [3] Zach is evaluating chat Widgets for chart-heavy answers and prefers line charts for time series.',
    '- [7,9] The Artifact Panel should open Memory pages beside the chat instead of copying them into the chat.',
    '- [14] Weekly demo review happens on Fridays.',
].join('\n');

const captureObservationsRecent = [
    '- [21] Demo chats reseed on every dev-stack start so UI states stay reproducible.',
    '- [23] Seeded demo data must never trigger real background model calls.',
].join('\n');

const dreamSummary =
    'Promoted the Artifact Panel linking rule to Demos/Panel Brief.md and noted the chart preference in USER.md.';

const demoUserCoreMemory = [
    '- Prefers line charts for time-series answers.',
    '- Reviews demo polish on Fridays.',
    '',
].join('\n');

export async function seedDevelopmentMemoryJobDemos({
    db,
    enabled = shouldSeedDevelopmentChatDemos(),
    now = new Date(),
    workspaceDir = AGENT_WORKSPACE,
}: {
    db: Database;
    enabled?: boolean;
    now?: Date;
    workspaceDir?: string;
}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    const jobs = buildDemoJobs(now);
    db.prepare(`DELETE FROM memory_jobs WHERE id IN (${jobs.map(() => '?').join(', ')})`).run(
        ...jobs.map((job) => job.id)
    );
    for (const job of jobs) {
        insertDemoJob(db, job);
    }

    await seedEpisodicBackingFiles(jobs, workspaceDir);
    await seedUserCoreMemoryIfEmpty(workspaceDir);
    return { seeded: jobs.length };
}

interface DemoMemoryJob {
    completedAt: string;
    createdAt: string;
    error: string | null;
    fileChangesJson: string;
    id: string;
    kind: 'dream' | 'extraction';
    metadataJson: string;
    modelCategory: 'fast' | 'standard';
    observations: string | null;
    sourceEndSequence: number | null;
    sourceStartSequence: number | null;
    status: 'completed' | 'failed' | 'skipped';
    transcriptJson: string;
    usageJson: string;
}

function buildDemoJobs(now: Date): DemoMemoryJob[] {
    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * hourMs).toISOString();
    const episodicPathFor = (createdAt: string) =>
        path.join('.memory', 'episodic', `${createdAt.slice(0, 10)}.md`);

    const earlyCreatedAt = at(26);
    const recentCreatedAt = at(6);

    return [
        {
            completedAt: earlyCreatedAt,
            createdAt: earlyCreatedAt,
            error: null,
            fileChangesJson: JSON.stringify([
                {
                    afterHash: 'demo-episodic-after-1',
                    beforeHash: null,
                    path: episodicPathFor(earlyCreatedAt),
                },
            ]),
            id: 'memjob_demo_capture_early',
            kind: 'extraction',
            metadataJson: JSON.stringify({
                extractionMode: 'observations',
                observations: captureObservationsEarly,
            }),
            modelCategory: 'fast',
            observations: captureObservationsEarly,
            sourceEndSequence: 18,
            sourceStartSequence: 1,
            status: 'completed',
            transcriptJson: '[]',
            usageJson: JSON.stringify({ inputTokens: 2140, outputTokens: 96, totalTokens: 2236 }),
        },
        {
            completedAt: at(20),
            createdAt: at(20),
            error: null,
            fileChangesJson: '[]',
            id: 'memjob_demo_capture_skipped',
            kind: 'extraction',
            metadataJson: JSON.stringify({
                extractionMode: 'observations',
                reason: 'no_durable_observations',
            }),
            modelCategory: 'fast',
            observations: null,
            sourceEndSequence: 20,
            sourceStartSequence: 19,
            status: 'skipped',
            transcriptJson: '[]',
            usageJson: JSON.stringify({ inputTokens: 310, outputTokens: 4, totalTokens: 314 }),
        },
        {
            completedAt: at(8),
            createdAt: at(8),
            error: 'The Fast model rejected the request: rate limited. Retrying later.',
            fileChangesJson: '[]',
            id: 'memjob_demo_capture_failed',
            kind: 'extraction',
            metadataJson: JSON.stringify({ extractionMode: 'observations' }),
            modelCategory: 'fast',
            observations: null,
            sourceEndSequence: 20,
            sourceStartSequence: 19,
            status: 'failed',
            transcriptJson: '[]',
            usageJson: '{}',
        },
        {
            completedAt: recentCreatedAt,
            createdAt: recentCreatedAt,
            error: null,
            fileChangesJson: JSON.stringify([
                {
                    afterHash: 'demo-episodic-after-2',
                    beforeHash: 'demo-episodic-before-2',
                    path: episodicPathFor(recentCreatedAt),
                },
            ]),
            id: 'memjob_demo_capture_recent',
            kind: 'extraction',
            metadataJson: JSON.stringify({
                extractionMode: 'observations',
                observations: captureObservationsRecent,
            }),
            modelCategory: 'fast',
            observations: captureObservationsRecent,
            sourceEndSequence: 24,
            sourceStartSequence: 21,
            status: 'completed',
            transcriptJson: '[]',
            usageJson: JSON.stringify({ inputTokens: 880, outputTokens: 54, totalTokens: 934 }),
        },
        {
            completedAt: at(5),
            createdAt: at(5),
            error: 'The Standard model rejected the request: rate limited.',
            fileChangesJson: '[]',
            id: 'memdream_demo_failed',
            kind: 'dream',
            metadataJson: JSON.stringify({ explicit: false }),
            modelCategory: 'standard',
            observations: null,
            sourceEndSequence: null,
            sourceStartSequence: null,
            status: 'failed',
            transcriptJson: '[]',
            usageJson: '{}',
        },
        {
            completedAt: at(4),
            createdAt: at(4),
            error: null,
            fileChangesJson: JSON.stringify([
                {
                    afterHash: 'demo-brief-after',
                    beforeHash: 'demo-brief-before',
                    path: 'Demos/Panel Brief.md',
                },
                { afterHash: 'demo-user-after', beforeHash: null, path: 'USER.md' },
            ]),
            id: 'memdream_demo_completed',
            kind: 'dream',
            metadataJson: JSON.stringify({ explicit: false, summary: dreamSummary }),
            modelCategory: 'standard',
            observations: null,
            sourceEndSequence: null,
            sourceStartSequence: null,
            status: 'completed',
            transcriptJson: JSON.stringify({
                text: dreamSummary,
                toolCalls: [
                    { input: {}, toolCallId: 'demo_1', toolName: 'memory_list_episodic' },
                    {
                        input: { name: 'USER.md' },
                        toolCallId: 'demo_2',
                        toolName: 'memory_read_core',
                    },
                    {
                        input: { path: 'Demos/Panel Brief.md' },
                        toolCallId: 'demo_3',
                        toolName: 'memory_write_page',
                    },
                    {
                        input: { name: 'USER.md' },
                        toolCallId: 'demo_4',
                        toolName: 'memory_write_core',
                    },
                ],
                toolResults: [],
            }),
            usageJson: JSON.stringify({ inputTokens: 5320, outputTokens: 410, totalTokens: 5730 }),
        },
    ];
}

function insertDemoJob(db: Database, job: DemoMemoryJob) {
    db.prepare(
        `INSERT INTO memory_jobs (
            id, kind, status, chat_id, agent_id, agent_participant_id,
            model_category, model_json, source_start_sequence, source_end_sequence,
            output_path, file_changes_json, usage_json, transcript_json,
            metadata_json, error, created_at, updated_at, started_at, completed_at
         )
         VALUES (
            $id, $kind, $status, $chatId, $agentId, $agentParticipantId,
            $modelCategory, $modelJson, $sourceStartSequence, $sourceEndSequence,
            $outputPath, $fileChangesJson, $usageJson, $transcriptJson,
            $metadataJson, $error, $createdAt, $createdAt, $createdAt, $completedAt
         )`
    ).run(
        namedParams({
            agentId: demoAgentId,
            agentParticipantId: job.kind === 'extraction' ? demoAgentId : null,
            chatId: job.kind === 'extraction' ? developmentChatDemoId : null,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
            error: job.error,
            fileChangesJson: job.fileChangesJson,
            id: job.id,
            kind: job.kind,
            metadataJson: job.metadataJson,
            modelCategory: job.modelCategory,
            modelJson: demoModelJson,
            outputPath:
                job.kind === 'extraction' && job.observations
                    ? path.join('.memory', 'episodic', `${job.createdAt.slice(0, 10)}.md`)
                    : null,
            sourceEndSequence: job.sourceEndSequence,
            sourceStartSequence: job.sourceStartSequence,
            status: job.status,
            transcriptJson: job.transcriptJson,
            usageJson: job.usageJson,
        })
    );
}

/** Append each demo capture's entry to its episodic day file, once per job id. */
async function seedEpisodicBackingFiles(jobs: DemoMemoryJob[], workspaceDir: string) {
    const episodicRoot = path.join(workspaceDir, '.memory', 'episodic');
    await fs.mkdir(episodicRoot, { recursive: true });

    for (const job of jobs) {
        if (job.kind !== 'extraction' || !job.observations) {
            continue;
        }
        const filePath = path.join(episodicRoot, `${job.createdAt.slice(0, 10)}.md`);
        const previous = await fs.readFile(filePath, 'utf8').catch(() => '');
        if (previous.includes(job.id)) {
            continue;
        }
        const entry = [
            `## ${job.createdAt} - ${developmentChatDemoId}`,
            '',
            `Source: chat \`${developmentChatDemoId}\`, agent seat \`${demoAgentId}\`, sequences ${job.sourceStartSequence}-${job.sourceEndSequence}, extraction job \`${job.id}\`.`,
            '',
            job.observations,
            '',
        ].join('\n');
        const next = previous ? `${previous.replace(/\s*$/u, '\n\n')}${entry}` : entry;
        await fs.writeFile(filePath, next);
    }
}

/** Give the demo dream's USER.md claim something to point at, without clobbering real edits. */
async function seedUserCoreMemoryIfEmpty(workspaceDir: string) {
    const userPath = path.join(workspaceDir, 'USER.md');
    const existing = await fs.readFile(userPath, 'utf8').catch(() => '');
    if (existing.trim()) {
        return;
    }
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(userPath, demoUserCoreMemory, { mode: 0o600 });
}
