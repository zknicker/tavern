import { buildAgentRuntimeSessionDetail } from './agent-runtime-detail.ts';
import {
    buildAgentRuntimeSessionMetadata,
    loadAgentRuntimeSessionSnapshot,
} from './agent-runtime-shared.ts';

export async function getSessionMetadata(sessionKey: string) {
    const snapshot = await loadAgentRuntimeSessionSnapshot(sessionKey);

    return snapshot ? buildAgentRuntimeSessionMetadata(snapshot) : null;
}

export const getSession = getSessionMetadata;

export async function getSessionDetail(input: {
    sessionKey: string;
    limit: number;
    offset: number;
}) {
    const snapshot = await loadAgentRuntimeSessionSnapshot(input.sessionKey);

    return snapshot
        ? buildAgentRuntimeSessionDetail({
              limit: input.limit,
              offset: input.offset,
              snapshot,
          })
        : null;
}
