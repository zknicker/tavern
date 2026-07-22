import { randomUUID } from 'node:crypto';
import type { AgentRuntimeAgentSession } from '@tavern/api';
import { readConfigValue } from '../config.ts';
import { log } from '../log.ts';
import { createAgentEngineExecutor } from './agent-engine-executor.ts';
import type { AgentExecutor, AgentExecutorInput } from './agent-executor.ts';
import { ensureCurrentAgentSession } from './agent-session-store.ts';
import {
    type AgentTurn,
    cancelAgentTurn,
    claimNextAgentTurnForAgent,
    completeAgentTurn,
    createAgentTurn,
    failAgentTurn,
    findRunningAgentTurnForAgent,
    getAgentTurn,
    hasQueuedAgentTurn,
    listAgentTurnsForSession,
} from './agent-turn-store.ts';
import { getStoredAgent } from './agents-store.ts';
import { registerInboxWakeSink } from './delivery-planner.ts';
import { advanceSeenCursor, clearInboxPierces, listPendingInboxTargets } from './inbox-cursors.ts';
import { composeDrainDelivery, type DrainDelivery } from './inbox-drain.ts';
import { noticeBusyAgent } from './inbox-notices.ts';
import { listServedCursors } from './served-ledger.ts';
import { registerTurnDelivery } from './turn-delivery.ts';
import { captureTurnWorkspaceBaseline, settleTurnFileEvidence } from './turn-file-evidence.ts';

// Floating turn runner (I1): one turn at a time per agent, anchored to the
// session. A wake on an idle agent claims one drain turn that delivers ALL
// pending targets batched; a wake on a busy agent flows into the content-free
// notice pipeline (I2). Sessions that never ran get a bare Start. turn first
// (ws2-turn-shapes.md §1). Chain budgets bound agent-to-agent ping-pong:
// consecutive drains with no human envelope stop at the budget and resume on
// the next human message.

type SettledTurnStatus = 'cancelled' | 'completed' | 'failed';

const defaultAgentTurnTimeoutMs = 5 * 60 * 1000;
// Top-tier thinking legitimately runs past the interactive watchdog (K3 at
// max regularly takes 7-10 minutes); those turns get a longer leash.
const extendedTurnTimeoutMs = 30 * 60 * 1000;
const agentChainBudget = 16;

const activeAgentRuns = new Map<string, string>();
const agentChainSpend = new Map<string, number>();
const turnWaiters = new Map<
    string,
    Array<(result: { error?: string; status: SettledTurnStatus }) => void>
>();
let executor: AgentExecutor = createAgentEngineExecutor();
// Bumped when tests swap the executor or database. A drain suspended across
// the swap (awaiting its workspace baseline) must abort instead of executing
// a stale turn against the new world. Never changes in production.
let executorEpoch = 0;

// The planner wakes agents; the runner decides drain vs notice. Notices ride
// the executor's mid-turn input channel via the turn-delivery registry.
registerInboxWakeSink({ wakeAgent });
registerTurnDelivery((runId, text) => executor.deliverUserMessage?.(runId, text) ?? false);

export function wakeAgent(agentId: string) {
    const running = findRunningAgentTurnForAgent(agentId);
    if (running) {
        void noticeBusyAgent({ agentId, runId: running.id });
        return;
    }
    scheduleAgentDrain(agentId);
}

export function scheduleAgentDrain(agentId: string) {
    const session = ensureCurrentAgentSession({ agentId });
    ensureStartTurn(agentId, session);
    if (!hasQueuedAgentTurn(agentId)) {
        createAgentTurn({
            agentId,
            agentSessionId: session.id,
            id: newRunId(),
            kind: 'drain',
        });
    }
    void drainAgent(agentId);
}

/** Session resets boot the fresh session with its Start. turn eagerly. */
export function scheduleAgentStart(agentId: string) {
    const session = ensureCurrentAgentSession({ agentId });
    ensureStartTurn(agentId, session);
    void drainAgent(agentId);
}

export async function stopAgentTurn(runId: string) {
    const turn = getAgentTurn(runId);
    if (!(turn && ['queued', 'running'].includes(turn.status))) {
        return false;
    }

    const wasActive = activeAgentRuns.get(turn.agentId) === runId;
    const cancelled = cancelAgentTurn({ id: runId });
    if (!cancelled) {
        return false;
    }
    if (wasActive) {
        await Promise.resolve(executor.stop?.(runId)).catch(() => {});
        clearActiveTurn(runId, turn.agentId);
    }
    notifyTurnSettled(runId, { status: 'cancelled' });
    void drainAgent(turn.agentId);
    return true;
}

export function waitForAgentTurnSettlement(runId: string): Promise<{
    error?: string;
    status: SettledTurnStatus;
}> {
    const existing = getAgentTurn(runId);
    if (existing && isSettledTurnStatus(existing.status)) {
        return Promise.resolve({
            error:
                typeof existing.metadata.error === 'string' ? existing.metadata.error : undefined,
            status: existing.status,
        });
    }

    return new Promise((resolve) => {
        const waiters = turnWaiters.get(runId) ?? [];
        waiters.push(resolve);
        turnWaiters.set(runId, waiters);
    });
}

export function resetAgentExecutorForTesting(nextExecutor?: AgentExecutor) {
    executor = nextExecutor ?? createAgentEngineExecutor();
    executorEpoch += 1;
    activeAgentRuns.clear();
    agentChainSpend.clear();
}

export function setAgentExecutorForTesting(nextExecutor: AgentExecutor) {
    const previous = executor;
    executor = nextExecutor;
    executorEpoch += 1;
    return () => {
        executor = previous;
        executorEpoch += 1;
        activeAgentRuns.clear();
        agentChainSpend.clear();
    };
}

// A session that never delivered a turn owes the bare Start. message first;
// after a reset the fresh-session line rides the same message.
function ensureStartTurn(agentId: string, session: AgentRuntimeAgentSession) {
    if (session.lastTurnAt || session.runtimeSessionId) {
        return;
    }
    const existing = listAgentTurnsForSession(session.id);
    if (existing.length > 0) {
        return;
    }
    createAgentTurn({
        agentId,
        agentSessionId: session.id,
        id: newRunId(),
        kind: 'start',
    });
}

function startTurnPrompt(session: AgentRuntimeAgentSession) {
    if (session.generation <= 1) {
        return 'Start.';
    }
    return [
        'Start.',
        'Fresh session: your previous conversation context is gone. Your workspace and MEMORY.md are intact — MEMORY.md is your recovery point.',
    ].join('\n');
}

async function drainAgent(agentId: string) {
    if (activeAgentRuns.has(agentId)) {
        return;
    }
    const turn = claimNextAgentTurnForAgent({ agentId });
    if (!turn) {
        return;
    }
    activeAgentRuns.set(agentId, turn.id);

    const agent = getStoredAgent(agentId);
    if (!agent) {
        failAgentTurn({ error: `Agent "${agentId}" no longer exists.`, id: turn.id });
        clearActiveTurn(turn.id, agentId);
        return;
    }
    // The claimed turn may predate a session reset or model switch; the
    // current session binding always wins.
    const session = ensureCurrentAgentSession({ agentId });

    const delivery =
        turn.kind === 'drain' ? composeDrainDelivery({ agentId, sessionId: session.id }) : null;
    if (turn.kind === 'drain' && !delivery) {
        // Raced pulls or resets consumed the backlog: nothing to deliver.
        cancelAgentTurn({ id: turn.id });
        clearActiveTurn(turn.id, agentId);
        notifyTurnSettled(turn.id, { status: 'cancelled' });
        void drainAgent(agentId);
        return;
    }
    if (delivery && !spendChainBudget(session.id, delivery)) {
        cancelAgentTurn({ id: turn.id });
        clearActiveTurn(turn.id, agentId);
        notifyTurnSettled(turn.id, { status: 'cancelled' });
        log.warn('Agent drain suppressed by chain budget', { agentId, runId: turn.id });
        return;
    }

    const input: AgentExecutorInput = {
        agent,
        agentSession: session,
        prompt: delivery?.prompt ?? startTurnPrompt(session),
        runId: turn.id,
    };

    // Workspace snapshots bracket the turn: the baseline strictly precedes
    // execution so the compared pair is exact file-change evidence.
    const drainEpoch = executorEpoch;
    const servedSnapshot = listServedCursors(session.id);
    const workspaceBaseline = await captureTurnWorkspaceBaseline(agentId);
    if (drainEpoch !== executorEpoch) {
        clearActiveTurn(turn.id, agentId);
        return;
    }

    try {
        const result = await executeAgentTurnWithTimeout(input);
        await settleTurnFileEvidence({ agentId, baseline: workspaceBaseline, runId: turn.id });
        if (getAgentTurn(turn.id)?.status === 'running') {
            completeAgentTurn({ contextTokens: result.contextTokens, id: turn.id });
            settleTurnCursors(session.id, delivery, servedSnapshot);
            notifyTurnSettled(turn.id, { status: 'completed' });
        }
    } catch (error) {
        await settleTurnFileEvidence({ agentId, baseline: workspaceBaseline, runId: turn.id });
        if (getAgentTurn(turn.id)?.status === 'running') {
            const errorMessage = formatTurnError(error);
            failAgentTurn({ error: errorMessage, id: turn.id });
            // No cursor advancement: a failed turn's envelopes were not
            // provably seen, so catch-up re-delivers from `seen` (I3).
            notifyTurnSettled(turn.id, { error: errorMessage, status: 'failed' });
        }
    } finally {
        clearActiveTurn(turn.id, agentId);
        // Only a completed turn earns an immediate re-drain of the remaining
        // backlog. A failed turn must not hot-loop retries — its pending rows
        // wait for the next external wake, with the error on the turn record.
        if (
            getAgentTurn(turn.id)?.status === 'completed' &&
            listPendingInboxTargets(session.id).length > 0
        ) {
            scheduleAgentDrain(agentId);
        } else {
            void drainAgent(agentId);
        }
    }
}

// Settle-time proofs (I3): envelopes embedded in the delivered prompt and
// pull outputs the turn committed (served cursor movement during the turn)
// advance `seen`; consumed pierce rows clear.
function settleTurnCursors(
    sessionId: string,
    delivery: DrainDelivery | null,
    servedSnapshot: Map<string, number>
) {
    for (const [chatId, seq] of delivery?.embeddedSeqByChatId ?? []) {
        advanceSeenCursor({ chatId, seq, sessionId });
    }
    if (delivery && delivery.pierceMessageIds.length > 0) {
        clearInboxPierces({ messageIds: delivery.pierceMessageIds, sessionId });
    }
    for (const [chatId, servedSeq] of listServedCursors(sessionId)) {
        if (servedSeq > (servedSnapshot.get(chatId) ?? 0)) {
            advanceSeenCursor({ chatId, seq: servedSeq, sessionId });
        }
    }
}

// Consecutive drains with no human envelope spend the session's chain
// budget; a human envelope resets it. At the ceiling the drain is suppressed
// (cursors untouched) until the next human message wakes the agent again.
function spendChainBudget(sessionId: string, delivery: DrainDelivery) {
    if (delivery.hasHumanEnvelope) {
        agentChainSpend.delete(sessionId);
        return true;
    }
    const spent = (agentChainSpend.get(sessionId) ?? 0) + 1;
    agentChainSpend.set(sessionId, spent);
    return spent <= agentChainBudget;
}

function notifyTurnSettled(
    runId: string,
    result: { error?: string; status: SettledTurnStatus }
): void {
    const waiters = turnWaiters.get(runId);
    if (!waiters) {
        return;
    }
    turnWaiters.delete(runId);
    for (const resolve of waiters) {
        resolve(result);
    }
}

function isSettledTurnStatus(status: string): status is SettledTurnStatus {
    return status === 'cancelled' || status === 'completed' || status === 'failed';
}

function clearActiveTurn(runId: string, agentId: string) {
    if (activeAgentRuns.get(agentId) === runId) {
        activeAgentRuns.delete(agentId);
    }
}

function newRunId() {
    return `run_${randomUUID().replaceAll('-', '')}`;
}

function executeAgentTurnWithTimeout(input: AgentExecutorInput) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = resolveAgentTurnTimeoutMs(input);
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            void Promise.resolve(executor.stop?.(input.runId)).catch(() => {});
            reject(new Error(`Agent turn timed out after ${formatDuration(timeoutMs)}.`));
        }, timeoutMs);
        timer.unref?.();
    });

    return Promise.race([executor.execute(input), timeout]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}

function resolveAgentTurnTimeoutMs(input: AgentExecutorInput) {
    const configured = Number(readConfigValue('TAVERN_AGENT_TURN_TIMEOUT_MS'));
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }
    if (input.agent.thinkingDefault === 'xhigh' || input.agent.thinkingDefault === 'max') {
        return extendedTurnTimeoutMs;
    }
    return defaultAgentTurnTimeoutMs;
}

function formatDuration(ms: number) {
    if (ms % 60_000 === 0) {
        return `${ms / 60_000}m`;
    }
    if (ms % 1000 === 0) {
        return `${ms / 1000}s`;
    }
    return `${ms}ms`;
}

function formatTurnError(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
        return String(error);
    }
    if (error === null || error === undefined) {
        return 'Agent turn failed.';
    }
    try {
        return JSON.stringify(error);
    } catch {
        return 'Agent turn failed with an unserializable error.';
    }
}

export type { AgentTurn };
