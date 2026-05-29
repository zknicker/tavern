import type { CortexSourceRef } from '@tavern/api';
import { hashText } from './ids';

export interface CortexChatSourceMessage {
    chat_id: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
}

export function sourceRefFromChatMessage(row: CortexChatSourceMessage): CortexSourceRef {
    return {
        id: `ctxs_${hashText(`${row.chat_id}:${row.id}`).slice(0, 24)}`,
        kind: row.role === 'assistant' ? 'agent' : row.role,
        locator: row.id,
    };
}
