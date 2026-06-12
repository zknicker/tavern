import type { TranscriptRow } from '../chat-transcript-model.ts';

export type ToolStepRow = Extract<TranscriptRow, { kind: 'tool' }>;

export interface ToolStepRendererProps {
    animateEnter?: boolean;
    canRespondToApproval?: boolean;
    canRespondToClarification?: boolean;
    chatId?: string;
    index: number;
    isLast: boolean;
    row: ToolStepRow;
}
