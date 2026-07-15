import { readCurrentAgentSession, startNewAgentSession } from './agent-session-store.ts';

/**
 * Idle safety valve (specs/sessions.md): sessions never rotate on a
 * schedule. A session untouched for ~7 days starts fresh on its next use —
 * a guard against stale engine resume state, identical in effect to a
 * manual session reset. Evaluated lazily before a turn starts.
 */
const idleResetMs = 7 * 24 * 60 * 60 * 1000;

export function ensureFreshAgentSession(input: { agentId: string; now?: Date }): 'idle' | null {
    const now = input.now ?? new Date();
    const session = readCurrentAgentSession({ agentId: input.agentId });
    if (!session || session.status !== 'active') {
        return null;
    }
    // A session that has never run a turn is fresh by construction.
    if (!session.runtimeSessionId) {
        return null;
    }

    const lastActive = new Date(session.lastTurnAt ?? session.updatedAt);
    if (now.getTime() - lastActive.getTime() < idleResetMs) {
        return null;
    }

    startNewAgentSession({ agentId: input.agentId, now: now.toISOString() });
    return 'idle';
}
