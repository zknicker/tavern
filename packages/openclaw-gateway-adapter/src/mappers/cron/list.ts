import { type AgentRuntimeCronList, agentRuntimeCronListSchema } from '@tavern/api';
import { asRecord, readRecordArray } from '../../gateway/records.ts';
import { mapOpenClawCronSummaryRecord } from './shared.ts';

export function mapOpenClawCronList(input: unknown): AgentRuntimeCronList {
    const record = asRecord(input);
    const jobs = readRecordArray(record, ['jobs', 'items', 'entries']).map((job) =>
        mapOpenClawCronSummaryRecord(job)
    );

    return agentRuntimeCronListSchema.parse({ jobs });
}
