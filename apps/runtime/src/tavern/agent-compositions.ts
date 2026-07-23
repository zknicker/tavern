import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getRuntimeRoot } from '../config.ts';
import { log } from '../log.ts';
import { publishRuntimeEvent } from './runtime-events.ts';

// Composition stream (I1): when the harness observer sees an in-flight
// `grotto message send`, the runtime mints a composition id, parks it where
// the agent's CLI wrapper exports it as GROTTO_COMPOSITION_ID, and publishes
// ephemeral composition events over the realtime socket. Volatile class:
// never persisted, never replayed. Terminal transitions are commit (the send
// carries the id and `message.created` echoes it — the app swaps the bubble
// for the durable message), retract (freshness hold), or client-side TTL
// fade (abandon/crash).

const sendCommandPattern = /\bgrotto\s+message\s+send\b/u;
const heredocBodyPattern = /<<\s*'?([A-Z]+)'?\s*\n([\s\S]*)$/u;
const targetFlagPattern = /--target[\s=]+("([^"]+)"|'([^']+)'|(\S+))/u;

export function compositionIdFilePath(agentId: string) {
    return path.join(getRuntimeRoot(), 'agent-bin', agentId, 'composition-id');
}

/**
 * Inspect a shell tool call's input for an in-flight `grotto message send`.
 * Returns the minted composition id when one was published, null otherwise.
 */
export function observeToolCallForComposition(input: {
    agentId: string;
    toolInput: unknown;
}): null | string {
    const command = extractCommandText(input.toolInput);
    if (!(command && sendCommandPattern.test(command))) {
        return null;
    }
    const compositionId = `cmp_${randomUUID().replaceAll('-', '')}`;
    try {
        const filePath = compositionIdFilePath(input.agentId);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, compositionId, { mode: 0o600 });
    } catch (error) {
        log.warn('Composition id handoff failed', { agentId: input.agentId, err: error });
        return null;
    }
    const targetMatch = targetFlagPattern.exec(command);
    const body = heredocBodyPattern.exec(command)?.[2] ?? '';
    publishComposition({
        agentId: input.agentId,
        compositionId,
        state: 'composing',
        target: targetMatch?.[2] ?? targetMatch?.[3] ?? targetMatch?.[4] ?? '',
        text: body.replace(/\n[A-Z]+\s*$/u, '').trimEnd(),
    });
    return compositionId;
}

/** Clear the parked id once the observed tool call settled. */
export function clearCompositionHandoff(agentId: string) {
    try {
        fs.rmSync(compositionIdFilePath(agentId), { force: true });
    } catch {
        // Best-effort: a stale file only risks tagging the next send.
    }
}

export function retractComposition(input: { agentId: string; compositionId: string }) {
    publishComposition({
        agentId: input.agentId,
        compositionId: input.compositionId,
        state: 'retracted',
        target: '',
        text: '',
    });
}

function publishComposition(input: {
    agentId: string;
    compositionId: string;
    state: 'composing' | 'retracted';
    target: string;
    text: string;
}) {
    publishRuntimeEvent({
        agentId: input.agentId,
        compositionId: input.compositionId,
        state: input.state,
        target: input.target,
        text: input.text,
        timestamp: new Date().toISOString(),
        type: 'agent.composition',
    });
}

function extractCommandText(toolInput: unknown): null | string {
    if (typeof toolInput === 'string') {
        return toolInput;
    }
    if (toolInput && typeof toolInput === 'object') {
        const record = toolInput as Record<string, unknown>;
        for (const key of ['command', 'cmd', 'script', 'input']) {
            if (typeof record[key] === 'string') {
                return record[key];
            }
        }
    }
    return null;
}
