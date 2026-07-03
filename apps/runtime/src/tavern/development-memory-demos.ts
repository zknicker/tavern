import fs from 'node:fs/promises';
import path from 'node:path';
import {
    prepareSemanticMemoryRoot,
    resolveSemanticMemoryConfigSync,
} from '../memory/semantic/store';
import { shouldSeedDevelopmentChatDemos } from './development-chat-demos';

const demoSemanticMemoryPages = [
    {
        body: [
            '# Artifact Panel brief',
            '',
            'The Artifact Panel opens inspectable outputs beside the chat that referenced them.',
            '',
            '## Contract',
            '',
            '- Links open Memory pages or workspace files.',
            '- Clicking a link opens a chat-scoped panel target.',
            '- Memory pages stay Memory pages; they are not copied into chat artifacts.',
            '',
            'Related: [Inspectable output rules](Output Rules.md)',
        ].join('\n'),
        path: 'Demos/Panel Brief.md',
    },
    {
        body: [
            '# Inspectable output rules',
            '',
            'Agents link outputs the user may want to inspect: workspace files, Memory pages, Markdown or HTML docs, images, and generated assets.',
            '',
            '| Target | Example |',
            '| --- | --- |',
            '| Memory page | `[Brief](tavern://memory/Demos/Panel%20Brief.md)` |',
            '| Workspace file | `[preview.html](tavern://workspace/out/preview.html)` |',
            '',
            'The final reply should link the thing itself. It should not explain the panel.',
        ].join('\n'),
        path: 'Demos/Output Rules.md',
    },
] as const;

export async function seedDevelopmentSemanticMemoryDemos({
    enabled = shouldSeedDevelopmentChatDemos(),
}: {
    enabled?: boolean;
} = {}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    const { memoryPath } = resolveSemanticMemoryConfigSync();
    await prepareSemanticMemoryRoot(memoryPath);

    for (const page of demoSemanticMemoryPages) {
        const absolutePath = path.join(memoryPath, page.path);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, `${page.body}\n`);
    }

    return { seeded: demoSemanticMemoryPages.length };
}
