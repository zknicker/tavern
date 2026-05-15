import type {
    MemoryRecallInput,
    MemoryRecallResult,
    MemoryRecord,
    MemoryWriteInput,
} from './contracts.js';

export interface MemoryStore {
    recall(input: MemoryRecallInput): Promise<MemoryRecallResult>;
    write(input: MemoryWriteInput): Promise<MemoryRecord>;
}
