import { findAgentRuntimeSession } from './agent-runtime-shared.ts';

export async function getSessionPrompt(input: { sessionKey: string }) {
    const resolved = await findAgentRuntimeSession(input.sessionKey);

    if (!resolved) {
        return null;
    }

    return resolved.client.getSessionPrompt(resolved.targetSession.key);
}
