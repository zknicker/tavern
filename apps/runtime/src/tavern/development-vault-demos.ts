import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareVaultRoot, resolveVaultConfigSync } from '../vault/store';
import { shouldSeedDevelopmentChatDemos } from './development-chat-demos';

const demoVaultPages = [
    {
        body: [
            '# Artifact Panel brief',
            '',
            'The Artifact Panel opens inspectable outputs beside the chat that referenced them.',
            '',
            '## Contract',
            '',
            '- Links use `tavern://vault/path` or `tavern://workspace/path`.',
            '- Clicking a link opens a chat-scoped panel target.',
            '- Vault pages stay Vault pages; they are not copied into chat artifacts.',
            '',
            'Related: [Inspectable output rules](Output Rules.md)',
        ].join('\n'),
        path: 'Demos/Panel Brief.md',
    },
    {
        body: [
            '# Inspectable output rules',
            '',
            'Agents link outputs the user may want to inspect: workspace files, Vault pages, Markdown or HTML docs, images, and generated assets.',
            '',
            '| Target | Example |',
            '| --- | --- |',
            '| Vault page | `[Brief](tavern://vault/Demos/Panel%20Brief.md)` |',
            '| Workspace file | `[preview.html](tavern://workspace/out/preview.html)` |',
            '',
            'The final reply should link the thing itself. It should not explain the panel.',
        ].join('\n'),
        path: 'Demos/Output Rules.md',
    },
] as const;

export async function seedDevelopmentVaultDemos({
    enabled = shouldSeedDevelopmentChatDemos(),
}: {
    enabled?: boolean;
} = {}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    const { vaultPath } = resolveVaultConfigSync();
    await prepareVaultRoot(vaultPath);

    for (const page of demoVaultPages) {
        const absolutePath = path.join(vaultPath, page.path);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, `${page.body}\n`);
    }

    return { seeded: demoVaultPages.length };
}
