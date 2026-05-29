import fs from 'node:fs';
import path from 'node:path';
import type { CortexPage, CortexSourceRef } from '@tavern/api';
import { renderCortexMarkdown } from './markdown';
import { resolveCortexWikiPath } from './read';

export function writeCanonicalCortexMarkdown(page: CortexPage): void {
    writeCanonicalCortexMarkdownDraft({
        aliases: page.aliases,
        body: page.body,
        compiledTruth: page.compiledTruth,
        frontmatter: page.frontmatter,
        id: page.id,
        slug: page.slug,
        sourceRefs: page.sourceRefs,
        status: page.status,
        tags: page.tags,
        timeline: page.timeline.map((entry) => ({
            body: entry.body,
            createdAt: entry.createdAt,
            sourceRefs: entry.sourceRefs,
        })),
        title: page.title,
        type: page.type,
        updatedAt: page.updatedAt,
    });
}

export function writeCanonicalCortexMarkdownDraft(input: {
    aliases: string[];
    body: string;
    compiledTruth: string;
    frontmatter?: Record<string, unknown>;
    id: string;
    slug: string;
    sourceRefs: CortexSourceRef[];
    status?: string;
    tags: string[];
    timeline: Array<{ body: string; createdAt: string; sourceRefs?: CortexSourceRef[] }>;
    title: string;
    type: string;
    updatedAt: string;
}): string {
    const cortexWikiPath = resolveCortexWikiPath();
    const markdownPath = path.join(cortexWikiPath, `${input.slug}.md`);
    fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
    fs.writeFileSync(
        markdownPath,
        renderCortexMarkdown({
            aliases: input.aliases,
            body: input.body,
            compiledTruth: input.compiledTruth,
            frontmatter: input.frontmatter,
            id: input.id,
            slug: input.slug,
            sourceRefs: input.sourceRefs,
            status: input.status,
            tags: input.tags,
            timeline: input.timeline,
            title: input.title,
            type: input.type,
            updatedAt: input.updatedAt,
        })
    );
    return markdownPath;
}
