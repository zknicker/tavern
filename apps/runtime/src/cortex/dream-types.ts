import type { CortexSourceRef } from '@tavern/api';

export interface CortexDreamResult {
    captured: number;
    modelReviewed: boolean;
    reviewed: number;
}

export interface DreamMessageRow {
    author_id: string;
    chat_id: string;
    content: string;
    created_at: string;
    id: string;
    role: 'assistant' | 'system' | 'user';
}

export interface DreamSourceRange {
    captureKey: string;
    messageIds: string[];
    sourceHash: string;
    sourceRefs: CortexSourceRef[];
    text: string;
}

export interface DreamContextPage {
    compiledTruth: string;
    links: Array<{ linkKind: string; targetSlug: string }>;
    slug: string;
    title: string;
    type: string;
}

export interface DreamPageWrite {
    action?: 'archive' | 'upsert';
    aliases?: string[];
    body?: string;
    compiledTruth: string;
    frontmatter?: Record<string, unknown>;
    slug?: string;
    tags?: string[];
    title: string;
    type?: string;
}

export interface DreamObservation {
    confidence?: number;
    pageSlug: string;
    predicate?: string;
    status?: 'active' | 'contradicted' | 'stale' | 'superseded';
    subject: string;
    value: string;
}

export interface DreamRelationship {
    fromSlug: string;
    label?: string | null;
    linkKind: string;
    targetSlug: string;
}

export interface DreamTimelineEntry {
    body: string;
    createdAt?: string;
    pageSlug: string;
}

export interface DreamCitation {
    locator: string;
    pageSlug: string;
    quote?: string | null;
}

export interface DreamNoop {
    reason: string;
}

export interface DreamWarning {
    message: string;
}

export interface DreamProposal {
    citations: DreamCitation[];
    noops: DreamNoop[];
    observations: DreamObservation[];
    pageWrites: DreamPageWrite[];
    relationships: DreamRelationship[];
    timelineEntries: DreamTimelineEntry[];
    warnings: DreamWarning[];
}

export interface DreamApplyResult {
    noops: DreamNoop[];
    outputHash: string;
    pageIds: string[];
    pagesTouched: number;
    promptHash: string;
    warnings: DreamWarning[];
}
