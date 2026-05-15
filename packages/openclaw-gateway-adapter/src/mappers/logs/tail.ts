import { asRecord, readArray, readString } from '../../gateway/records.ts';

export interface OpenClawLogLine {
    cursor: string | null;
    line: string;
}

export function mapOpenClawLogTail(input: unknown): OpenClawLogLine[] {
    const record = asRecord(input);

    return readArray(record.lines ?? input)
        .map((line) => {
            if (typeof line === 'string') {
                return { cursor: null, line };
            }

            const lineRecord = asRecord(line);
            const text = readString(lineRecord, ['line', 'text', 'message']);
            return text ? { cursor: readString(lineRecord, ['cursor']), line: text } : null;
        })
        .filter((line): line is OpenClawLogLine => line !== null);
}
