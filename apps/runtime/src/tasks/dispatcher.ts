import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { log } from '../log.ts';
import { listStoredAgents } from '../tavern/agents-store.ts';
import { formatLocalDateSlug } from '../timezone.ts';
import { resolveHomeTimezone } from '../timezone-settings.ts';
import { isAutoDispatchEligible, orderAutoDispatchTasks } from './eligibility.ts';
import { getAutoDispatchSettings } from './settings.ts';
import { listTasks } from './store.ts';
import { dispatchTaskWorkOrder } from './work-order.ts';

export const autoDispatchIntervalMs = 60_000;

export interface TaskDispatcherHandle {
    stop(): void;
}

let activeHandle: TaskDispatcherHandle | null = null;

export function startTaskDispatcher(): TaskDispatcherHandle {
    if (activeHandle) {
        return activeHandle;
    }
    let running = false;
    const tick = async () => {
        if (running) {
            return;
        }
        running = true;
        try {
            await runAutoDispatchTick();
        } catch (error) {
            log.warn('Task auto-dispatch tick failed', { err: error });
        } finally {
            running = false;
        }
    };
    const timer = setInterval(() => void tick(), autoDispatchIntervalMs);
    timer.unref?.();
    activeHandle = {
        stop() {
            clearInterval(timer);
            if (activeHandle === this) {
                activeHandle = null;
            }
        },
    };
    void tick();
    return activeHandle;
}

export function isTaskDispatcherReady() {
    return activeHandle !== null;
}

export async function runAutoDispatchTick(
    input: { db?: Database; dispatch?: typeof dispatchTaskWorkOrder; now?: Date } = {}
) {
    const db = input.db ?? getDb();
    const initialSettings = getAutoDispatchSettings(db);
    if (!initialSettings.autoDispatchEnabled) {
        return { claimed: 0 };
    }

    const live = readLiveAutoDispatches(db);
    let activeCount = live.length;
    const activeAgents = new Set(live.map((row) => row.agentId));
    const busyAgents = readBusyAgents(db);
    const agents = new Map(listStoredAgents(db).agents.map((agent) => [agent.id, agent]));
    const tasks = listTasks({}, db);
    const statuses = new Map(tasks.map((task) => [task.id, task.status]));
    const localDate = formatLocalDateSlug(input.now ?? new Date(), resolveHomeTimezone());
    const candidates = orderAutoDispatchTasks(tasks);
    const attempted = new Set<string>();
    let claimed = 0;

    for (const task of candidates) {
        const settings = getAutoDispatchSettings(db);
        if (!settings.autoDispatchEnabled || activeCount >= settings.autoDispatchConcurrency) {
            break;
        }
        const agentId = task.assignee?.kind === 'agent' ? task.assignee.agentId : null;
        if (!agentId || attempted.has(task.id)) {
            continue;
        }
        const agent = agents.get(agentId);
        if (
            !isAutoDispatchEligible(task, {
                agentAtCapacity: activeAgents.has(agentId),
                agentAutoDispatchEnabled: agent?.autoDispatchEnabled === true,
                agentBusy: busyAgents.has(agentId),
                dependenciesDone: task.blockedBy.every(
                    (dependencyId) => statuses.get(dependencyId) === 'done'
                ),
                globalAtCapacity: activeCount >= settings.autoDispatchConcurrency,
                globalEnabled: settings.autoDispatchEnabled,
                localDate,
            })
        ) {
            continue;
        }

        attempted.add(task.id);
        try {
            await (input.dispatch ?? dispatchTaskWorkOrder)({
                agentId,
                db,
                taskId: task.id,
                trigger: 'auto',
            });
            claimed += 1;
            activeCount += 1;
            activeAgents.add(agentId);
            busyAgents.add(agentId);
        } catch (error) {
            log.warn('Task auto-dispatch claim failed', { err: error, taskId: task.id });
        }
    }
    return { claimed };
}

function readLiveAutoDispatches(db: Database) {
    return db
        .prepare(
            `SELECT tasks.assignee_agent_id AS agent_id
             FROM tasks
             JOIN agent_turns ON agent_turns.id = tasks.active_dispatch_run_id
             WHERE tasks.dispatch_trigger = 'auto'
               AND tasks.active_dispatch_run_id IS NOT NULL
               AND agent_turns.status IN ('queued', 'running')`
        )
        .all()
        .map((row) => ({ agentId: (row as { agent_id: string }).agent_id }));
}

function readBusyAgents(db: Database) {
    const rows = db
        .prepare("SELECT DISTINCT agent_id FROM agent_turns WHERE status = 'running'")
        .all() as Array<{ agent_id: string }>;
    return new Set(rows.map((row) => row.agent_id));
}
