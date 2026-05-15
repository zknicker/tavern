import { findAgentRuntimeSession } from './agent-runtime-shared.ts';

export async function resyncSession(input: { sessionKey: string }) {
    const resolved = await findAgentRuntimeSession(input.sessionKey);

    if (!resolved) {
        return null;
    }

    return resolved.client.resyncSession(resolved.targetSession.key);
}
