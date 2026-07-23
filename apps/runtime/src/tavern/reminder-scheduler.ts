import { formatLocalTime } from '../cli/agent-format.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { getStoredAgent } from './agents-store.ts';
import { createMessageId } from './chat-api/ids.ts';
import { createMessage } from './chat-api/index.ts';
import { wakeAgentForReminder } from './delivery-planner.ts';
import { nextFireAtMs, parseCadence } from './reminder-cadence.ts';
import {
    dueReminders,
    markReminderFired,
    type ReminderRecord,
    recordReminderRun,
    rescheduleReminder,
} from './reminder-store.ts';

// Reminder fires (D4): server-owned schedules tick here. A script reminder
// runs its payload locally at zero model cost — empty output records a quiet
// tick; output (or no script) posts a 🔔 system message in the anchored
// surface and wakes the owning agent only.

const TICK_INTERVAL_MS = 15_000;
const SCRIPT_TIMEOUT_MS = 60_000;
const SCRIPT_OUTPUT_CAP = 16_384;

export interface ReminderScriptResult {
    exitCode: number;
    stderr: string;
    stdout: string;
}

export type ReminderScriptRunner = (input: {
    cwd: string;
    script: string;
}) => Promise<ReminderScriptResult>;

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

export function installReminderScheduler(): void {
    if (timer) {
        return;
    }
    timer = setInterval(() => {
        if (ticking) {
            return;
        }
        ticking = true;
        void tickReminders({ nowMs: Date.now() })
            .catch((err: unknown) => log.warn('Reminder tick failed', { err }))
            .finally(() => {
                ticking = false;
            });
    }, TICK_INTERVAL_MS);
    timer.unref?.();
}

export function stopReminderScheduler(): void {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

/** One scheduler pass; exported for deterministic tests. */
export async function tickReminders(
    input: {
        nowMs: number;
        runScript?: ReminderScriptRunner;
        timezone?: string;
    },
    db: Database = getDb()
): Promise<void> {
    const due = dueReminders(input.nowMs, db);
    for (const reminder of due) {
        try {
            await fireReminder(reminder, input, db);
        } catch (err) {
            recordReminderRun(
                {
                    errorMessage: err instanceof Error ? err.message : String(err),
                    outcome: 'error',
                    reminderId: reminder.id,
                },
                db
            );
            advance(reminder, input, db);
            log.warn('Reminder fire failed', { err, reminderId: reminder.id });
        }
    }
}

async function fireReminder(
    reminder: ReminderRecord,
    input: { nowMs: number; runScript?: ReminderScriptRunner; timezone?: string },
    db: Database
): Promise<void> {
    let output = '';
    let scriptExitCode: number | null = null;
    let scriptStderr: string | null = null;
    if (reminder.script) {
        const agent = getStoredAgent(reminder.ownerAgentId, db);
        if (!agent) {
            throw new Error('Owning agent no longer exists.');
        }
        const runner = input.runScript ?? runReminderScript;
        const result = await runner({ cwd: agent.workspaceFolder, script: reminder.script });
        output = result.stdout.slice(0, SCRIPT_OUTPUT_CAP).trim();
        scriptExitCode = result.exitCode;
        scriptStderr = result.stderr ? result.stderr.slice(0, SCRIPT_OUTPUT_CAP) : null;
        if (!output) {
            // Quiet tick: logged, no message, no wake — the watchdog economics.
            recordReminderRun(
                {
                    outcome: result.exitCode === 0 ? 'quiet' : 'error',
                    ...(result.exitCode === 0
                        ? {}
                        : { errorMessage: `Script exited ${result.exitCode}.` }),
                    reminderId: reminder.id,
                    scriptExitCode,
                    scriptStderr,
                },
                db
            );
            advance(reminder, input, db);
            return;
        }
    }
    const content = output
        ? `🔔 Reminder: ${reminder.title}\n${output}`
        : `🔔 Reminder: ${reminder.title}`;
    const receipt = createMessage(
        reminder.anchorChatId,
        {
            author_id: 'sys_reminder',
            content,
            id: createMessageId(),
            metadata: {
                runtime: {
                    reminderId: reminder.id,
                    reminderOwnerAgentId: reminder.ownerAgentId,
                    source: 'reminder-fire',
                },
            },
            role: 'system',
        },
        db
    );
    recordReminderRun(
        {
            messageId: receipt.message.id,
            outcome: scriptExitCode !== null && scriptExitCode !== 0 ? 'error' : 'fired',
            ...(scriptExitCode !== null && scriptExitCode !== 0
                ? { errorMessage: `Script exited ${scriptExitCode}.` }
                : {}),
            output: output || null,
            reminderId: reminder.id,
            scriptExitCode,
            scriptStderr,
        },
        db
    );
    advance(reminder, input, db);
    wakeAgentForReminder(reminder.ownerAgentId, reminder.anchorChatId, receipt.message);
}

function advance(
    reminder: ReminderRecord,
    input: { nowMs: number; timezone?: string },
    db: Database
): void {
    const cadence = reminder.repeat ? parseCadence(reminder.repeat) : null;
    if (!cadence) {
        markReminderFired(reminder.id, db);
        return;
    }
    // Late fires (runtime was off) advance from now, not from the missed
    // slot — one fire per gap, never a burst.
    const timezone = input.timezone ?? resolveHomeTimezone();
    rescheduleReminder(reminder.id, nextFireAtMs(cadence, input.nowMs, timezone), db);
}

async function runReminderScript(input: {
    cwd: string;
    script: string;
}): Promise<ReminderScriptResult> {
    const child = Bun.spawn(['/bin/zsh', '-lc', input.script], {
        cwd: input.cwd,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const timeout = setTimeout(() => child.kill(), SCRIPT_TIMEOUT_MS);
    try {
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
            child.exited,
        ]);
        return { exitCode, stderr, stdout };
    } finally {
        clearTimeout(timeout);
    }
}

/** Human-facing schedule receipt posted into the anchored surface. */
export function reminderScheduleReceipt(reminder: ReminderRecord, ownerHandle: string): string {
    const fires = formatLocalTime(new Date(reminder.fireAtMs).toISOString());
    const repeat = reminder.repeat ? `, repeats ${reminder.repeat}` : '';
    return `🔔 @${ownerHandle} scheduled a reminder: "${reminder.title}" (fires ${fires}${repeat})`;
}
