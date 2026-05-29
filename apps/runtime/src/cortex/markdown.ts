import type { CortexLink } from '@tavern/api';
import type { CortexSchemaDefinition } from './cortex-schema';
import { slugifyCortexTitle } from './ids';

const maxChunkCharacters = 1200;

export interface CortexChunkDraft {
    ordinal: number;
    section: string;
    text: string;
    tokenCount: number;
}

export function splitCortexChunks(input: { body: string; compiledTruth: string }) {
    return [
        ...splitSection('compiled_truth', input.compiledTruth),
        ...splitSection('body', input.body),
    ].filter((chunk) => chunk.text.trim().length > 0);
}

export function extractWikiLinks(
    text: string
): Pick<CortexLink, 'heading' | 'label' | 'linkKind' | 'sourceLocation' | 'targetSlug'>[] {
    return extractWikilinkRefs(text);
}

export function extractCortexLinks(input: {
    body: string;
    compiledTruth: string;
    frontmatter: Record<string, unknown>;
    pageType: string;
    schema: CortexSchemaDefinition;
}): Pick<CortexLink, 'heading' | 'label' | 'linkKind' | 'sourceLocation' | 'targetSlug'>[] {
    const text = `${input.compiledTruth}\n${input.body}`;
    return dedupeLinks([
        ...extractWikilinkRefs(text),
        ...extractMarkdownRefs(text),
        ...extractBareSlugRefs(text),
        ...extractFrontmatterRefs(input.frontmatter, input.pageType, input.schema),
    ]);
}

export function renderCortexMarkdown(input: {
    aliases: string[];
    body: string;
    compiledTruth: string;
    frontmatter?: Record<string, unknown>;
    id: string;
    slug: string;
    sourceRefs: Array<{ id: string; kind: string; locator: string | null }>;
    status?: string;
    tags: string[];
    timeline: Array<{
        body: string;
        createdAt: string;
        sourceRefs?: Array<{ id: string; kind: string; locator: string | null }>;
    }>;
    title: string;
    type: string;
    updatedAt: string;
}) {
    const frontmatter = [
        '---',
        `id: ${input.id}`,
        `slug: ${input.slug}`,
        `status: ${input.status ?? 'active'}`,
        `type: ${input.type}`,
        `aliases: ${JSON.stringify(input.aliases)}`,
        `tags: ${JSON.stringify(input.tags)}`,
        ...renderExtraFrontmatter(input.frontmatter),
        `source_refs: ${JSON.stringify(input.sourceRefs)}`,
        `updated_at: ${input.updatedAt}`,
        '---',
    ].join('\n');
    const timeline = input.timeline.map(renderTimelineEntry).join('\n\n');

    return `${frontmatter}\n\n# ${input.title}\n\n## Compiled Truth\n\n${input.compiledTruth.trim()}\n\n## Body\n\n${input.body.trim()}\n\n---\n\n## Timeline\n\n${timeline}\n`;
}

function renderTimelineEntry(input: {
    body: string;
    createdAt: string;
    sourceRefs?: Array<{ id: string; kind: string; locator: string | null }>;
}): string {
    const sourceRefs =
        input.sourceRefs && input.sourceRefs.length > 0
            ? `\n\n<!-- source_refs: ${JSON.stringify(input.sourceRefs)} -->`
            : '';
    return `### ${input.createdAt}${sourceRefs}\n\n${input.body}`;
}

function renderExtraFrontmatter(frontmatter: Record<string, unknown> | undefined): string[] {
    if (!frontmatter) {
        return [];
    }
    const reserved = new Set([
        'aliases',
        'id',
        'slug',
        'source_refs',
        'status',
        'tags',
        'type',
        'updated_at',
    ]);
    return Object.entries(frontmatter)
        .filter(([key]) => !reserved.has(key))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
}

function splitSection(section: string, text: string): CortexChunkDraft[] {
    const chunks: CortexChunkDraft[] = [];
    let current = '';
    let ordinal = 0;

    for (const paragraph of text.split(/\n{2,}/u)) {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
        if (candidate.length > maxChunkCharacters && current.trim()) {
            chunks.push(toChunk(section, ordinal, current));
            ordinal += 1;
            current = paragraph;
        } else {
            current = candidate;
        }
    }

    if (current.trim()) {
        chunks.push(toChunk(section, ordinal, current));
    }

    return chunks;
}

function toChunk(section: string, ordinal: number, text: string): CortexChunkDraft {
    return {
        ordinal,
        section,
        text: text.trim(),
        tokenCount: estimateTokenCount(text),
    };
}

function estimateTokenCount(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
}

function cleanNullable(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

type CortexLinkDraft = Pick<
    CortexLink,
    'heading' | 'label' | 'linkKind' | 'sourceLocation' | 'targetSlug'
>;

function extractWikilinkRefs(text: string): CortexLinkDraft[] {
    return Array.from(text.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/gu)).map(
        (match, index) => ({
            heading: cleanNullable(match[2]),
            label: cleanNullable(match[3]),
            linkKind: 'mentions',
            sourceLocation: `wikilink:${index}`,
            targetSlug: slugifyCortexTitle(match[1] ?? ''),
        })
    );
}

function extractMarkdownRefs(text: string): CortexLinkDraft[] {
    return Array.from(text.matchAll(/\[([^\]]+)\]\(([^):\s][^)]+)\)/gu))
        .filter((match) => !String(match[2] ?? '').includes('://'))
        .map((match, index) => ({
            heading: null,
            label: cleanNullable(match[1]),
            linkKind: 'mentions',
            sourceLocation: `markdown:${index}`,
            targetSlug: slugifyCortexTitle(String(match[2] ?? '').replace(/\.md$/u, '')),
        }));
}

function extractBareSlugRefs(text: string): CortexLinkDraft[] {
    return Array.from(text.matchAll(/\b([a-z][a-z0-9-]*\/[a-z0-9][a-z0-9/-]*[a-z0-9])\b/gu)).map(
        (match, index) => ({
            heading: null,
            label: null,
            linkKind: 'mentions',
            sourceLocation: `slug:${index}`,
            targetSlug: slugifyCortexTitle(match[1] ?? ''),
        })
    );
}

function extractFrontmatterRefs(
    frontmatter: Record<string, unknown>,
    pageType: string,
    schema: CortexSchemaDefinition
): CortexLinkDraft[] {
    const linkTypes = new Set(schema.linkTypes.map((type) => type.name));
    const links: CortexLinkDraft[] = [];
    for (const mapping of schema.frontmatterMappings) {
        if (mapping.pageType && mapping.pageType !== pageType) {
            continue;
        }
        if (!linkTypes.has(mapping.linkType)) {
            continue;
        }
        for (const field of mapping.fields) {
            const entries = normalizeRefEntries(frontmatter[field]);
            entries.forEach((entry, index) => {
                links.push({
                    heading: null,
                    label: null,
                    linkKind: mapping.linkType,
                    sourceLocation: `frontmatter:${field}:${index}`,
                    targetSlug: slugifyCortexTitle(entry),
                });
            });
        }
    }
    return links;
}

function normalizeRefEntries(value: unknown): string[] {
    const entries = Array.isArray(value) ? value : value == null ? [] : [value];
    return entries.flatMap((entry) => {
        if (typeof entry === 'string' && entry.trim()) {
            return [entry.trim()];
        }
        if (entry && typeof entry === 'object') {
            const record = entry as Record<string, unknown>;
            const value = record.slug ?? record.name ?? record.title;
            return typeof value === 'string' && value.trim() ? [value.trim()] : [];
        }
        return [];
    });
}

function dedupeLinks(links: CortexLinkDraft[]): CortexLinkDraft[] {
    const seen = new Set<string>();
    return links.filter((link) => {
        const key = `${link.targetSlug}:${link.heading ?? ''}:${link.linkKind}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
