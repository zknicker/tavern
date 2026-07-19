import { developmentChatTeamDemoId } from '@tavern/api/development-chat-demos';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { createMessage, getMessage, upsertResponse } from './chat-api';
import { demoAgentId, demoSecondAgentId } from './development-chat-demo-types';

// Activity scenery for the dev stack: demo automations with a week of runs,
// plus completed turn lineage over the seeded demo transcripts, so the home
// Activity feed and the Automations page read as a lived-in workspace. All
// rows use namespaced ids (cron_demo_*, cronrun_demo_*, agtturn_demo_*) and
// are refreshed on every boot; real rows are never touched.

const digestJobId = 'cron_demo_digest';
const triageJobId = 'cron_demo_triage';
const digestMessageId = 'msg_demo_digest_output';
const digestResponseId = 'rsp_demo_digest';

export function seedDevelopmentActivityDemos(db: Database) {
    seedDemoAutomations(db);
    seedDemoDigestTurn(db);
    seedDemoRepliedTurns(db);
}

function seedDemoAutomations(db: Database) {
    db.prepare("DELETE FROM cron_runs WHERE id LIKE 'cronrun_demo_%'").run();
    db.prepare('DELETE FROM cron_jobs WHERE id = $digest OR id = $triage').run(
        namedParams({ digest: digestJobId, triage: triageJobId })
    );

    const insertJob = db.prepare(
        `INSERT INTO cron_jobs (
            id, agent_id, name, description, enabled, schedule_json, delivery_json,
            payload_json, delete_after_run, consecutive_errors, created_at, updated_at
         )
         VALUES ($id, $agentId, $name, $description, $enabled, $scheduleJson, $deliveryJson,
            $payloadJson, 0, 0, $createdAt, $createdAt)`
    );
    insertJob.run(
        namedParams({
            agentId: demoAgentId,
            createdAt: '2026-06-12T09:00:00.000Z',
            deliveryJson: JSON.stringify({ chatId: developmentChatTeamDemoId }),
            description: 'Daily summary of merged work and open incidents.',
            enabled: 1,
            id: digestJobId,
            name: 'Morning digest',
            payloadJson: JSON.stringify({
                kind: 'agentTurn',
                message: 'Post the morning digest: merged PRs, open incidents, and anything stuck.',
            }),
            scheduleJson: JSON.stringify({ expr: '0 9 * * *', kind: 'cron' }),
        })
    );
    insertJob.run(
        namedParams({
            agentId: demoSecondAgentId,
            createdAt: '2026-06-13T17:00:00.000Z',
            deliveryJson: JSON.stringify({ chatId: developmentChatTeamDemoId }),
            description: 'End-of-day sweep over the task queue.',
            enabled: 0,
            id: triageJobId,
            name: 'Queue triage',
            payloadJson: JSON.stringify({
                kind: 'agentTurn',
                message: 'Triage the task queue and flag anything risky.',
            }),
            scheduleJson: JSON.stringify({ expr: '0 17 * * 1-5', kind: 'cron' }),
        })
    );

    const insertRun = db.prepare(
        `INSERT INTO cron_runs (
            id, job_id, trigger, status, scheduled_for, chat_id, turn_id,
            started_at, finished_at, execution_error_code, execution_error_message,
            created_at, updated_at
         )
         VALUES ($id, $jobId, 'schedule', $status, $scheduledFor, $chatId, NULL,
            $scheduledFor, $finishedAt, $errorCode, $errorMessage, $scheduledFor, $finishedAt)`
    );

    for (const day of [13, 14, 15, 16, 17, 18]) {
        const scheduledFor = `2026-06-${day}T09:00:00.000Z`;
        insertRun.run(
            namedParams({
                chatId: developmentChatTeamDemoId,
                errorCode: null,
                errorMessage: null,
                finishedAt: `2026-06-${day}T09:01:10.000Z`,
                id: `cronrun_demo_digest_${day}`,
                jobId: digestJobId,
                scheduledFor,
                status: 'success',
            })
        );
    }

    const triageRuns = [
        { day: 16, error: null },
        { day: 17, error: 'Calendar plugin token expired.' },
        { day: 18, error: null },
    ];
    for (const run of triageRuns) {
        insertRun.run(
            namedParams({
                chatId: developmentChatTeamDemoId,
                errorCode: run.error ? 'execution_failed' : null,
                errorMessage: run.error,
                finishedAt: `2026-06-${run.day}T17:00:40.000Z`,
                id: `cronrun_demo_triage_${run.day}`,
                jobId: triageJobId,
                scheduledFor: `2026-06-${run.day}T17:00:00.000Z`,
                status: run.error ? 'error' : 'success',
            })
        );
    }
}

// One cron-triggered turn so the feed shows an automation firing. The trigger
// message is the digest's chat post, exactly as the live executor authors it.
function seedDemoDigestTurn(db: Database) {
    if (!getMessage(digestMessageId, db)) {
        createMessage(
            developmentChatTeamDemoId,
            {
                author_id: demoAgentId,
                content:
                    'Morning digest: 3 PRs merged overnight, release notes drafted, no open incidents.',
                id: digestMessageId,
                metadata: {
                    runtime: { source: 'development-demo' },
                    tavern: { cronJobId: digestJobId, source: 'cron' },
                },
                role: 'assistant',
            },
            db
        );
        db.prepare('UPDATE chat_messages SET created_at = $at WHERE id = $id').run(
            namedParams({ at: '2026-06-18T15:30:05.000Z', id: digestMessageId })
        );
    }

    upsertResponse(
        developmentChatTeamDemoId,
        {
            completed_at: '2026-06-18T15:30:10.000Z',
            id: digestResponseId,
            metadata: {
                runtime: {
                    agentSessionId: demoTurnSessionId(demoAgentId),
                    source: 'development-demo',
                },
            },
            participant_id: demoAgentId,
            response_message_id: digestMessageId,
            status: 'completed',
            summary: 'Posted the morning digest.',
        },
        db
    );
    insertDemoTurn(db, {
        agentId: demoAgentId,
        chatId: developmentChatTeamDemoId,
        completedAt: '2026-06-18T15:30:10.000Z',
        createdAt: '2026-06-18T15:29:00.000Z',
        id: 'agtturn_demo_digest',
        responseId: digestResponseId,
        triggerMessageId: digestMessageId,
    });
}

// Completed turn rows over the seeded demo responses, so each demo reply
// also reads as "replied in <chat>" activity.
function seedDemoRepliedTurns(db: Database) {
    // Timestamps come from the demo-pinned reply message, not the response
    // row (whose created_at is boot time); triggers prefer the recorded
    // request message and fall back to the latest earlier user message, so
    // every turn satisfies the store's foreign keys.
    const responses = db
        .prepare(
            `SELECT r.id, r.chat_id, r.participant_id, r.request_message_id,
                    r.response_message_id,
                    COALESCE(m.created_at, r.created_at) AS happened_at
             FROM chat_responses r
             LEFT JOIN chat_messages m ON m.id = r.response_message_id
             WHERE json_extract(r.metadata_json, '$.runtime.source') = 'development-demo'
               AND r.id != $digestResponseId
             ORDER BY happened_at ASC, r.id ASC`
        )
        .all(namedParams({ digestResponseId })) as {
        chat_id: string;
        happened_at: string;
        id: string;
        participant_id: string;
        request_message_id: null | string;
        response_message_id: null | string;
    }[];
    const findTrigger = db.prepare(
        `SELECT id FROM chat_messages
         WHERE chat_id = $chatId AND role = 'user' AND created_at <= $before
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
    );
    const hasSession = db.prepare('SELECT 1 FROM agent_sessions WHERE id = $id');

    for (const response of responses) {
        const triggerMessageId =
            response.request_message_id ??
            (
                findTrigger.get(
                    namedParams({ before: response.happened_at, chatId: response.chat_id })
                ) as { id: string } | undefined
            )?.id ??
            response.response_message_id;
        const sessionId = demoTurnSessionId(response.participant_id);

        if (!(triggerMessageId && hasSession.get(namedParams({ id: sessionId })))) {
            continue;
        }

        const happenedMs = Date.parse(response.happened_at);
        const createdAt = Number.isNaN(happenedMs)
            ? response.happened_at
            : new Date(happenedMs - 40_000).toISOString();

        insertDemoTurn(db, {
            agentId: response.participant_id,
            chatId: response.chat_id,
            completedAt: response.happened_at,
            createdAt,
            id: `agtturn_demo_${response.id}`,
            responseId: response.id,
            triggerMessageId,
        });
    }
}

function insertDemoTurn(
    db: Database,
    input: {
        agentId: string;
        chatId: string;
        completedAt: string;
        createdAt: string;
        id: string;
        responseId: string;
        triggerMessageId: string;
    }
) {
    db.prepare('DELETE FROM agent_turns WHERE id = $id').run(namedParams({ id: input.id }));
    db.prepare(
        `INSERT INTO agent_turns (
            id, chat_id, agent_session_id, agent_participant_id, agent_id,
            trigger_message_id, response_id, status, attempt,
            output_message_ids_json, activity_ids_json, metadata_json,
            created_at, updated_at, started_at, completed_at
         )
         VALUES ($id, $chatId, $agentSessionId, $agentParticipantId, $agentId,
            $triggerMessageId, $responseId, 'completed', 1,
            '[]', '[]', '{"runtime":{"source":"development-demo"}}',
            $createdAt, $completedAt, $createdAt, $completedAt)`
    ).run(
        namedParams({
            agentId: input.agentId,
            // Demo agent ids are already agt_-prefixed participant ids.
            agentParticipantId: input.agentId,
            agentSessionId: demoTurnSessionId(input.agentId),
            chatId: input.chatId,
            completedAt: input.completedAt,
            createdAt: input.createdAt,
            id: input.id,
            responseId: input.responseId,
            triggerMessageId: input.triggerMessageId,
        })
    );
}

// Ties demo turns to the newest demo-seeded session generation
// (development-chat-demos.ts): the primary agent's history runs to
// generation 4, other seats stop at 1.
function demoTurnSessionId(agentId: string) {
    const generation = agentId === demoAgentId ? 4 : 1;

    return `ags_${agentId}_demo_${generation}`;
}
