import type { TranscriptRow } from '../chat-transcript-model.ts';

export type ToolStepRow = Extract<TranscriptRow, { kind: 'tool' }>;

export interface ToolStepRendererProps {
    chatId?: string;
    index: number;
    isLast: boolean;
    row: ToolStepRow;
}
