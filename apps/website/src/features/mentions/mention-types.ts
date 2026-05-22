export type MentionKind = 'app' | 'directory' | 'file' | 'image' | 'plugin' | 'skill';
export type MentionProjection =
    | 'capability-reference'
    | 'image-input'
    | 'path-reference'
    | 'skill-context';

export interface Mention {
    end: number;
    id: string;
    kind: MentionKind;
    label: string;
    metadata?: Record<string, unknown>;
    projection: MentionProjection;
    start: number;
    text: string;
}

export interface MentionOption {
    description?: string | null;
    id: string;
    insertText: string;
    kind: MentionKind;
    label: string;
    metadata?: Record<string, unknown>;
    projection: MentionProjection;
    sourceLabel?: string | null;
}

export interface ActiveMentionQuery {
    end: number;
    query: string;
    start: number;
}
