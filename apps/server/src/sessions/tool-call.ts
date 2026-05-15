import { buildAgentRuntimeSessionToolDetail } from './agent-runtime-detail.ts';
import { loadAgentRuntimeSessionSnapshot } from './agent-runtime-shared.ts';

export async function getSessionToolCall(input: { sessionKey: string; toolCallId: string }) {
    const snapshot = await loadAgentRuntimeSessionSnapshot(input.sessionKey);

    return snapshot
        ? buildAgentRuntimeSessionToolDetail({
              snapshot,
              toolCallId: input.toolCallId,
          })
        : null;
}
