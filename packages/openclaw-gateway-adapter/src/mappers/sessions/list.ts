import {
    type AgentRuntimeSessionList,
    agentRuntimeSessionListSchema,
} from '@tavern/agent-runtime-protocol';
import { asRecord, readRecordArray } from '../../gateway/records.ts';
import { mapOpenClawSessionRecord } from './shared.ts';

export function mapOpenClawSessionList(input: unknown): AgentRuntimeSessionList {
    const record = asRecord(input);
    const sessions = readRecordArray(record, ['sessions', 'items', 'entries']).map((session) =>
        mapOpenClawSessionRecord(session)
    );

    return agentRuntimeSessionListSchema.parse({ sessions });
}
