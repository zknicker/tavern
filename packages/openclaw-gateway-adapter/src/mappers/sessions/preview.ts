import {
    type AgentRuntimeSessionPreviewList,
    agentRuntimeSessionPreviewListSchema,
} from '@tavern/api';
import { asRecord, readArray, readNumber, readString } from '../../gateway/records.ts';

export function mapOpenClawSessionPreviews(input: unknown): AgentRuntimeSessionPreviewList {
    const record = asRecord(input);
    const previews = readArray(record.previews).map((preview) => {
        const previewRecord = asRecord(preview);

        return {
            items: readArray(previewRecord.items).flatMap((item) => {
                const itemRecord = asRecord(item);
                const role = readString(itemRecord, ['role']);
                const text = readString(itemRecord, ['text']);

                return role && text !== null ? [{ role, text }] : [];
            }),
            key: readString(previewRecord, ['key']) ?? 'unknown',
            status: readPreviewStatus(readString(previewRecord, ['status'])),
        };
    });

    return agentRuntimeSessionPreviewListSchema.parse({
        previews,
        ts: readNumber(record, ['ts']) ?? undefined,
    });
}

function readPreviewStatus(value: string | null) {
    switch (value) {
        case 'empty':
        case 'error':
        case 'missing':
        case 'ok':
            return value;
        default:
            return 'error';
    }
}
