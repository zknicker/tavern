import fs from 'node:fs';
import path from 'node:path';
import type { CortexPage } from '@tavern/api';
import { renderCortexMarkdown } from './markdown';
import { resolveCortexWikiPath } from './read';

export function writeMarkdownMirror(page: CortexPage): void {
    const cortexWikiPath = resolveCortexWikiPath();
    const mirrorPath = path.join(cortexWikiPath, `${page.slug}.md`);
    fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
    fs.writeFileSync(
        mirrorPath,
        renderCortexMarkdown({
            aliases: page.aliases,
            body: page.body,
            compiledTruth: page.compiledTruth,
            id: page.id,
            slug: page.slug,
            tags: page.tags,
            timeline: page.timeline.map((entry) => ({
                body: entry.body,
                createdAt: entry.createdAt,
            })),
            title: page.title,
            type: page.type,
            updatedAt: page.updatedAt,
        })
    );
}
