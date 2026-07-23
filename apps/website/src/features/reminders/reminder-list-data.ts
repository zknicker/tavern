import { formatRelativeTime, formatTimestamp } from '../../lib/format.ts';
import type { ReminderListOutput, ReminderRunsOutput } from '../../lib/trpc.tsx';
import { formatReminderSchedule } from './reminder-cadence.ts';

// Ported from cron-list-data.ts. Builds the reminder list-item view model the
// sidebar, list, and status badges read. Cron's job.state.* machinery
// (running/next/last-run timestamps, error codes) maps onto the reminder's
// fire time plus its most recent run.
export interface ReminderExecution {
    firedAt: string;
    firedAtFormatted: string;
    firedAtRelative: string;
    id: string;
    messageId: string | null;
    outcome: ReminderRunsOutput['runs'][number]['outcome'];
}

type ReminderRunRecordRaw = ReminderRunsOutput['runs'][number];

function buildExecutions(runs: ReminderRunRecordRaw[], now = Date.now()): ReminderExecution[] {
    return [...runs]
        .sort((left, right) => Date.parse(right.firedAt) - Date.parse(left.firedAt))
        .slice(0, 8)
        .map((run) => ({
            firedAt: run.firedAt,
            firedAtFormatted: formatTimestamp(run.firedAt),
            firedAtRelative: formatRelativeTime(run.firedAt, now),
            id: run.id,
            messageId: run.messageId,
            outcome: run.outcome,
        }));
}

export function buildReminderList(
    reminders: ReminderListOutput['reminders'],
    runs: ReminderRunsOutput['runs'] = [],
    now = Date.now()
) {
    const runsByReminderId = new Map<string, ReminderRunRecordRaw[]>();
    for (const run of runs) {
        const existing = runsByReminderId.get(run.reminderId) ?? [];
        existing.push(run);
        runsByReminderId.set(run.reminderId, existing);
    }

    return reminders.map((reminder) => {
        const executions = buildExecutions(runsByReminderId.get(reminder.id) ?? [], now);
        const latest = executions.length > 0 ? executions[0] : null;
        const lastOutcome: 'error' | 'fired' | 'quiet' | 'unknown' = latest?.outcome ?? 'unknown';

        return {
            anchorChatId: reminder.anchor_chat_id,
            executions,
            id: reminder.id,
            isScript: Boolean(reminder.script),
            lastErrorMessage:
                lastOutcome === 'error'
                    ? (runsByReminderId.get(reminder.id)?.[0]?.errorMessage ?? null)
                    : null,
            lastRun: latest ? formatRelativeTime(latest.firedAt, now) : 'unknown',
            lastOutcome,
            name: reminder.title,
            nextRun:
                reminder.status === 'scheduled' ? formatTimestamp(reminder.fire_at) : 'unknown',
            ownerAgentId: reminder.owner_agent_id,
            ownerHandle: reminder.owner_handle,
            reminder,
            schedule: formatReminderSchedule(reminder),
            status: reminder.status,
        };
    });
}

export type ReminderListItem = ReturnType<typeof buildReminderList>[number];
