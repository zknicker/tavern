import type { CortexLink } from '@tavern/api';
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

export function renderCortexMarkdown(input: {
    aliases: string[];
    body: string;
    compiledTruth: string;
    id: string;
    slug: string;
    tags: string[];
    timeline: Array<{ body: string; createdAt: string }>;
    title: string;
    type: string;
    updatedAt: string;
}) {
    const frontmatter = [
        '---',
        `id: ${input.id}`,
        `slug: ${input.slug}`,
        `type: ${input.type}`,
        `aliases: ${JSON.stringify(input.aliases)}`,
        `tags: ${JSON.stringify(input.tags)}`,
        `updated_at: ${input.updatedAt}`,
        '---',
    ].join('\n');
    const timeline = input.timeline
        .map((entry) => `### ${entry.createdAt}\n\n${entry.body}`)
        .join('\n\n');

    return `${frontmatter}\n\n# ${input.title}\n\n## Compiled Truth\n\n${input.compiledTruth.trim()}\n\n## Body\n\n${input.body.trim()}\n\n---\n\n## Timeline\n\n${timeline}\n`;
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
