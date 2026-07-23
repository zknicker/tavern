import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

// Reminders (D4): the only scheduling primitive. Author-owned, anchored to a
// message, server-owned schedules. Fires land as system messages in the
// anchored surface and wake only the owner; `reminder log` reads the runs.

export type ReminderStatus = 'scheduled' | 'fired' | 'canceled';
export type ReminderRunOutcome = 'fired' | 'quiet' | 'error';

export interface ReminderRecord {
    anchorChatId: string;
    anchorMessageId: string;
    createdAt: string;
    fireAtMs: number;
    id: string;
    ownerAgentId: string;
    repeat: string | null;
    script: string | null;
    status: ReminderStatus;
    title: string;
    updatedAt: string;
}

export interface ReminderRunRecord {
    errorMessage: string | null;
    firedAt: string;
    id: string;
    messageId: string | null;
    outcome: ReminderRunOutcome;
    output: string | null;
    reminderId: string;
    scriptExitCode: number | null;
    scriptStderr: string | null;
}

export function createReminder(
    input: {
        anchorChatId: string;
        anchorMessageId: string;
        fireAtMs: number;
        ownerAgentId: string;
        repeat?: string | null;
        script?: string | null;
        title: string;
    },
    db: Database = getDb()
): ReminderRecord {
    const now = new Date().toISOString();
    const id = createReminderId();
    db.prepare(
        `INSERT INTO reminders
         (id, owner_agent_id, title, anchor_chat_id, anchor_message_id, fire_at_ms,
          repeat, script, status, created_at, updated_at)
         VALUES ($id, $ownerAgentId, $title, $anchorChatId, $anchorMessageId, $fireAtMs,
          $repeat, $script, 'scheduled', $now, $now)`
    ).run(
        namedParams({
            anchorChatId: input.anchorChatId,
            anchorMessageId: input.anchorMessageId,
            fireAtMs: input.fireAtMs,
            id,
            now,
            ownerAgentId: input.ownerAgentId,
            repeat: input.repeat ?? null,
            script: input.script ?? null,
            title: input.title,
        })
    );
    return getReminderOrThrow(id, db);
}

export function getReminder(id: string, db: Database = getDb()): ReminderRecord | null {
    const row = db
        .prepare('SELECT * FROM reminders WHERE id = $id')
        .get(namedParams({ id })) as ReminderRow | null;
    return row ? rowToReminder(row) : null;
}

export function getReminderOrThrow(id: string, db: Database = getDb()): ReminderRecord {
    const reminder = getReminder(id, db);
    if (!reminder) {
        throw new Error(`Reminder ${id} does not exist.`);
    }
    return reminder;
}

export function listReminders(
    input: { ownerAgentId?: string; statuses?: ReminderStatus[] } = {},
    db: Database = getDb()
): ReminderRecord[] {
    const statuses = input.statuses?.length ? input.statuses : null;
    const rows = db
        .prepare(
            `SELECT * FROM reminders
             WHERE ($ownerAgentId IS NULL OR owner_agent_id = $ownerAgentId)
               AND ($statuses IS NULL OR instr($statuses, ',' || status || ',') > 0)
             ORDER BY
               CASE status WHEN 'scheduled' THEN 0 ELSE 1 END,
               fire_at_ms ASC`
        )
        .all(
            namedParams({
                ownerAgentId: input.ownerAgentId ?? null,
                statuses: statuses ? `,${statuses.join(',')},` : null,
            })
        ) as ReminderRow[];
    return rows.map(rowToReminder);
}

export function dueReminders(nowMs: number, db: Database = getDb()): ReminderRecord[] {
    const rows = db
        .prepare(
            `SELECT * FROM reminders
             WHERE status = 'scheduled' AND fire_at_ms <= $nowMs
             ORDER BY fire_at_ms ASC`
        )
        .all(namedParams({ nowMs })) as ReminderRow[];
    return rows.map(rowToReminder);
}

export function rescheduleReminder(
    id: string,
    fireAtMs: number,
    db: Database = getDb()
): ReminderRecord {
    db.prepare(
        `UPDATE reminders SET fire_at_ms = $fireAtMs, status = 'scheduled', updated_at = $now
         WHERE id = $id`
    ).run(namedParams({ fireAtMs, id, now: new Date().toISOString() }));
    return getReminderOrThrow(id, db);
}

export function updateReminder(
    id: string,
    patch: { fireAtMs?: number; repeat?: string | null; script?: string | null; title?: string },
    db: Database = getDb()
): ReminderRecord {
    const existing = getReminderOrThrow(id, db);
    db.prepare(
        `UPDATE reminders
         SET title = $title, fire_at_ms = $fireAtMs, repeat = $repeat, script = $script,
             updated_at = $now
         WHERE id = $id`
    ).run(
        namedParams({
            fireAtMs: patch.fireAtMs ?? existing.fireAtMs,
            id,
            now: new Date().toISOString(),
            repeat: patch.repeat === undefined ? existing.repeat : patch.repeat,
            script: patch.script === undefined ? existing.script : patch.script,
            title: patch.title ?? existing.title,
        })
    );
    return getReminderOrThrow(id, db);
}

export function markReminderFired(id: string, db: Database = getDb()): ReminderRecord {
    db.prepare(`UPDATE reminders SET status = 'fired', updated_at = $now WHERE id = $id`).run(
        namedParams({ id, now: new Date().toISOString() })
    );
    return getReminderOrThrow(id, db);
}

export function cancelReminder(id: string, db: Database = getDb()): ReminderRecord {
    db.prepare(`UPDATE reminders SET status = 'canceled', updated_at = $now WHERE id = $id`).run(
        namedParams({ id, now: new Date().toISOString() })
    );
    return getReminderOrThrow(id, db);
}

export function recordReminderRun(
    input: {
        errorMessage?: string | null;
        messageId?: string | null;
        outcome: ReminderRunOutcome;
        output?: string | null;
        reminderId: string;
        scriptExitCode?: number | null;
        scriptStderr?: string | null;
    },
    db: Database = getDb()
): ReminderRunRecord {
    const id = `rrun_${crypto.randomUUID().replaceAll('-', '')}`;
    db.prepare(
        `INSERT INTO reminder_runs
         (id, reminder_id, fired_at, outcome, output, script_exit_code, script_stderr,
          message_id, error_message)
         VALUES ($id, $reminderId, $firedAt, $outcome, $output, $scriptExitCode, $scriptStderr,
          $messageId, $errorMessage)`
    ).run(
        namedParams({
            errorMessage: input.errorMessage ?? null,
            firedAt: new Date().toISOString(),
            id,
            messageId: input.messageId ?? null,
            outcome: input.outcome,
            output: input.output ?? null,
            reminderId: input.reminderId,
            scriptExitCode: input.scriptExitCode ?? null,
            scriptStderr: input.scriptStderr ?? null,
        })
    );
    const row = db
        .prepare('SELECT * FROM reminder_runs WHERE id = $id')
        .get(namedParams({ id })) as ReminderRunRow;
    return rowToRun(row);
}

export function listReminderRuns(
    input: { limit?: number; ownerAgentId?: string; reminderId?: string } = {},
    db: Database = getDb()
): ReminderRunRecord[] {
    const rows = db
        .prepare(
            `SELECT reminder_runs.* FROM reminder_runs
             JOIN reminders ON reminders.id = reminder_runs.reminder_id
             WHERE ($reminderId IS NULL OR reminder_runs.reminder_id = $reminderId)
               AND ($ownerAgentId IS NULL OR reminders.owner_agent_id = $ownerAgentId)
             ORDER BY reminder_runs.fired_at DESC
             LIMIT $limit`
        )
        .all(
            namedParams({
                limit: Math.min(Math.max(input.limit ?? 50, 1), 200),
                ownerAgentId: input.ownerAgentId ?? null,
                reminderId: input.reminderId ?? null,
            })
        ) as ReminderRunRow[];
    return rows.map(rowToRun);
}

interface ReminderRow {
    anchor_chat_id: string;
    anchor_message_id: string;
    created_at: string;
    fire_at_ms: number;
    id: string;
    owner_agent_id: string;
    repeat: string | null;
    script: string | null;
    status: ReminderStatus;
    title: string;
    updated_at: string;
}

interface ReminderRunRow {
    error_message: string | null;
    fired_at: string;
    id: string;
    message_id: string | null;
    outcome: ReminderRunOutcome;
    output: string | null;
    reminder_id: string;
    script_exit_code: number | null;
    script_stderr: string | null;
}

function rowToReminder(row: ReminderRow): ReminderRecord {
    return {
        anchorChatId: row.anchor_chat_id,
        anchorMessageId: row.anchor_message_id,
        createdAt: row.created_at,
        fireAtMs: row.fire_at_ms,
        id: row.id,
        ownerAgentId: row.owner_agent_id,
        repeat: row.repeat,
        script: row.script,
        status: row.status,
        title: row.title,
        updatedAt: row.updated_at,
    };
}

function rowToRun(row: ReminderRunRow): ReminderRunRecord {
    return {
        errorMessage: row.error_message,
        firedAt: row.fired_at,
        id: row.id,
        messageId: row.message_id,
        outcome: row.outcome,
        output: row.output,
        reminderId: row.reminder_id,
        scriptExitCode: row.script_exit_code,
        scriptStderr: row.script_stderr,
    };
}

function createReminderId() {
    return `rem_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}
