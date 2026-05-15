import {
    type MemoryRecallInput,
    type MemoryRecallResult,
    type MemoryRecord,
    type MemoryWriteInput,
    memoryRecallInputSchema,
    memoryWriteInputSchema,
} from './contracts.js';
import type { MemoryStore } from './store.js';

export interface MemoryService {
    recall(input: MemoryRecallInput): Promise<MemoryRecallResult>;
    write(input: MemoryWriteInput): Promise<MemoryRecord>;
}

export function createMemoryService(store: MemoryStore): MemoryService {
    return {
        recall(input) {
            return store.recall(memoryRecallInputSchema.parse(input));
        },
        write(input) {
            return store.write(memoryWriteInputSchema.parse(input));
        },
    };
}
