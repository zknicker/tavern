import {
    type AgentRuntimeAgentList,
    agentRuntimeAgentListSchema,
} from '@tavern/agent-runtime-protocol';
import { asRecord, readRecordArray } from '../../gateway/records.ts';
import { mapOpenClawAgentRecord } from './shared.ts';

export function mapOpenClawAgentList(input: unknown): AgentRuntimeAgentList {
    const record = asRecord(input);
    const agents = readRecordArray(record, ['agents', 'items', 'entries']).map((agent) =>
        mapOpenClawAgentRecord(agent)
    );

    return agentRuntimeAgentListSchema.parse({ agents });
}
