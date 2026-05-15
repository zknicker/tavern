import { buildAgentRuntimeSessionLogPage } from './agent-runtime-detail.ts';
import { loadAgentRuntimeSessionSnapshot } from './agent-runtime-shared.ts';

export async function getSessionLogPage(input: {
    sessionKey: string;
    limit: number;
    offset: number;
}) {
    const snapshot = await loadAgentRuntimeSessionSnapshot(input.sessionKey);

    return snapshot
        ? buildAgentRuntimeSessionLogPage({
              limit: input.limit,
              offset: input.offset,
              snapshot,
          })
        : null;
}
