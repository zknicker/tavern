import {
    buildAgentRuntimeSessionHistoryRows,
    sortAndAnnotateHistoryRows,
} from './agent-runtime-history-rows.ts';
import {
    type AgentRuntimeSessionSnapshot,
    buildAgentRuntimeSessionMetadata,
    buildAgentRuntimeSessionRelationships,
} from './agent-runtime-shared.ts';
import { sessionHistorySchema } from './contracts.ts';

export function buildAgentRuntimeSessionHistory(input: {
    limit: number;
    offset?: number;
    snapshot: AgentRuntimeSessionSnapshot;
}) {
    const rows = sortAndAnnotateHistoryRows(buildAgentRuntimeSessionHistoryRows(input.snapshot));
    const total = rows.length;
    const offset =
        typeof input.offset === 'number'
            ? Math.min(input.offset, total)
            : Math.max(total - input.limit, 0);
    const relationships = buildAgentRuntimeSessionRelationships(input.snapshot);

    return sessionHistorySchema.parse({
        offset,
        parentRelationship:
            relationships.find((relationship) => relationship.direction === 'incoming') ?? null,
        rows: rows.slice(offset, offset + input.limit),
        session: buildAgentRuntimeSessionMetadata(input.snapshot),
        total,
    });
}
