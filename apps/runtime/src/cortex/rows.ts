import type {
    CortexCaptureInput,
    CortexLink,
    CortexPage,
    CortexPageSummary,
    CortexSourceRef,
} from '@tavern/api';
import { hashText, slugifyCortexTitle } from './ids';

export interface PageRow {
    body: string;
    compiled_truth: string;
    content_hash: string;
    created_at: string;
    frontmatter_json: string;
    id: string;
    slug: string;
    source_refs_json: string;
    status: CortexPageSummary['status'];
    title: string;
    type: CortexPageSummary['type'];
    updated_at: string;
}

export interface ClaimRow {
    confidence: number | null;
    id: string;
    page_id: string;
    predicate: string;
    source_refs_json: string;
    status: CortexPage['claims'][number]['status'];
    subject: string;
    supersedes_claim_id: string | null;
    value: string;
}

export interface ChunkEncodingRow {
    page_id: string;
    score_text: string;
    vector_json: string | null;
}

export interface LinkRow {
    from_page_id: string;
    heading: string | null;
    id: string;
    label: string | null;
    link_kind: string;
    source_location: string | null;
    target_page_id: string | null;
    target_slug: string;
}

export interface TimelineRow {
    body: string;
    created_at: string;
    id: string;
    source_refs_json: string;
}

export function toPageSummary(
    row: Pick<
        PageRow,
        'frontmatter_json' | 'id' | 'slug' | 'status' | 'title' | 'type' | 'updated_at'
    >
): CortexPageSummary {
    const frontmatter = readJsonRecord(row.frontmatter_json);
    return {
        aliases: readStringArray(frontmatter.aliases),
        id: row.id,
        slug: row.slug,
        status: row.status,
        tags: readStringArray(frontmatter.tags),
        title: row.title,
        type: row.type,
        updatedAt: row.updated_at,
    };
}

export function toLink(row: LinkRow): CortexLink {
    return {
        fromPageId: row.from_page_id,
        heading: row.heading,
        id: row.id,
        label: row.label,
        linkKind: row.link_kind,
        sourceLocation: row.source_location,
        targetPageId: row.target_page_id,
        targetSlug: row.target_slug,
    };
}

export function sourceRefFromCapture(input: CortexCaptureInput): CortexSourceRef {
    const locator =
        input.source.messageId ??
        input.source.fileId ??
        input.source.url ??
        input.source.turnId ??
        input.source.sessionKey ??
        input.source.chatId ??
        input.source.actorId;
    return {
        id: `ctxs_${hashText(JSON.stringify(input.source)).slice(0, 24)}`,
        kind: input.source.actorKind,
        locator,
    };
}

export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length > 1);
}

export function scoreLexical(text: string, queryTerms: string[]): number {
    const haystack = text.toLowerCase();
    return queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function snippet(page: PageRow, queryTerms: string[]): string {
    const text = page.compiled_truth || page.body;
    const lower = text.toLowerCase();
    const index = queryTerms.map((term) => lower.indexOf(term)).find((termIndex) => termIndex >= 0);
    if (index === undefined) {
        return text.slice(0, 220);
    }
    return text.slice(Math.max(0, index - 80), index + 180);
}

export function readJsonRecord(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

export function readJsonArray<T>(value: string): T[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
        return [];
    }
}

export function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

export function normalizePageLookup(value: string): string {
    return slugifyCortexTitle(value);
}

export function nowIso(): string {
    return new Date().toISOString();
}
