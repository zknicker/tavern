import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareWikiRoot, resolveWikiConfigSync } from '../wiki/store';
import { shouldSeedDevelopmentChatDemos } from './development-chat-demos';

const demoWikiPages = [
    {
        body: [
            '# Artifact Panel brief',
            '',
            'The Artifact Panel opens inspectable outputs beside the chat that referenced them.',
            '',
            '## Contract',
            '',
            '- Links open Wiki pages or workspace files.',
            '- Clicking a link opens a chat-scoped panel target.',
            '- Wiki pages stay Wiki pages; they are not copied into chat artifacts.',
            '',
            'Related: [Inspectable output rules](Output Rules.md)',
        ].join('\n'),
        path: 'Demos/Panel Brief.md',
    },
    {
        body: [
            '# Inspectable output rules',
            '',
            'Agents link outputs the user may want to inspect: workspace files, Wiki pages, Markdown or HTML docs, images, and generated assets.',
            '',
            '| Target | Example |',
            '| --- | --- |',
            '| Wiki page | `[Brief](grotto://wiki/Demos/Panel%20Brief.md)` |',
            '| Workspace file | `[preview.html](grotto://workspace/out/preview.html)` |',
            '',
            'The final reply should link the thing itself. It should not explain the panel.',
        ].join('\n'),
        path: 'Demos/Output Rules.md',
    },
] as const;

export async function seedDevelopmentWikiDemos({
    enabled = shouldSeedDevelopmentChatDemos(),
}: {
    enabled?: boolean;
} = {}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    const { wikiPath } = resolveWikiConfigSync();
    await prepareWikiRoot(wikiPath);

    for (const page of demoWikiPages) {
        const absolutePath = path.join(wikiPath, page.path);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, `${page.body}\n`);
    }

    return { seeded: demoWikiPages.length };
}
