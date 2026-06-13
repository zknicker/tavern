export type MentionKind = 'app' | 'directory' | 'file' | 'image' | 'plugin' | 'skill';
// Picker options cover one extra kind: commands render in the same picker but
// execute as actions and never serialize into stored Mention metadata.
export type MentionOptionKind = MentionKind | 'command';
export type MentionTrigger = '@' | '$' | '/';
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
    kind: MentionOptionKind;
    label: string;
    metadata?: Record<string, unknown>;
    projection: MentionProjection;
    sourceLabel?: string | null;
    statusAdornment?: {
        kind: 'context-fullness';
        percent: number;
    };
}

export interface ActiveMentionQuery {
    end: number;
    query: string;
    start: number;
    trigger: MentionTrigger;
}
