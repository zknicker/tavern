import type { AgentRuntimeCreateCron, AgentRuntimeCron, AgentRuntimeUpdateCron } from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { createAgentParticipantId } from '../tavern/chat-api/ids.ts';
import { nextRunAtFromSchedule } from './schedule.ts';
import { createCronJob, getCronJob, updateCronJob } from './store.ts';

export function createValidatedCronJob(input: AgentRuntimeCreateCron, db: Database = getDb()) {
    validateSchedule(input.schedule);
    validateCronDelivery({ agentId: input.agentId, delivery: input.delivery, db });
    return createCronJob(input, db);
}

export function updateValidatedCronJob(
    id: string,
    input: AgentRuntimeUpdateCron,
    db: Database = getDb()
): AgentRuntimeCron | null {
    const existing = getCronJob(id, db);
    if (!existing) {
        return null;
    }
    const next = { ...existing, ...input };
    validateSchedule(next.schedule);
    validateCronDelivery({ agentId: next.agentId, delivery: next.delivery, db });
    return updateCronJob(id, input, db);
}

export function validateCronDelivery(input: {
    agentId: string;
    db?: Database;
    delivery: AgentRuntimeCron['delivery'];
}): void {
    const db = input.db ?? getDb();
    if (!getStoredAgent(input.agentId, db)) {
        throw new Error(`Cron agent "${input.agentId}" does not exist.`);
    }
    const participantId = createAgentParticipantId(input.agentId);
    const row = db
        .prepare(
            `SELECT kind
             FROM chat_participants
             WHERE chat_id = $chatId AND id = $participantId
             LIMIT 1`
        )
        .get(
            namedParams({
                chatId: input.delivery.chatId,
                participantId,
            })
        ) as { kind: string } | null;
    if (row?.kind !== 'agent') {
        throw new Error(
            `Cron agent "${input.agentId}" is not a participant of chat "${input.delivery.chatId}".`
        );
    }
}

function validateSchedule(schedule: AgentRuntimeCreateCron['schedule']) {
    // Rejects invalid cron expressions, timezones, and datetimes before the
    // row persists; a stored bad schedule would poison every later reconcile.
    nextRunAtFromSchedule(schedule);
}
