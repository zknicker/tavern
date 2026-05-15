import { buildAgentRuntimeSessionHistory } from './agent-runtime-history.ts';
import { loadAgentRuntimeSessionSnapshot } from './agent-runtime-shared.ts';

export async function getSessionHistory(input: {
    sessionKey: string;
    limit: number;
    offset?: number;
}) {
    const snapshot = await loadAgentRuntimeSessionSnapshot(input.sessionKey);

    return snapshot
        ? buildAgentRuntimeSessionHistory({
              limit: input.limit,
              offset: input.offset,
              snapshot,
          })
        : null;
}
