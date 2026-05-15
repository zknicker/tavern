export type ToolMentionKind = 'app' | 'skill' | 'tool';

export interface ToolMention {
    end: number;
    id: string;
    kind: ToolMentionKind;
    label: string;
    start: number;
    text: string;
}

export interface ToolMentionOption {
    description?: string | null;
    id: string;
    kind: ToolMentionKind;
    label: string;
    sourceLabel?: string | null;
}

export interface ActiveToolMentionQuery {
    end: number;
    query: string;
    start: number;
}
