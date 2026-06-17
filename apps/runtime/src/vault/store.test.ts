import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    getVaultPage,
    getVaultSettings,
    getVaultStatus,
    listVaultBacklinks,
    listVaultPages,
    saveVaultSettings,
    searchVault,
} from './store.ts';

describe('Vault store', () => {
    let root: string;
    let previousVaultPath: string | undefined;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-vault-store-'));
        previousVaultPath = process.env.TAVERN_VAULT_PATH;
        process.env.TAVERN_VAULT_PATH = root;
        const db = initTestDb();
        ensureRuntimeSchema(db);

        await fs.mkdir(path.join(root, 'Projects'), { recursive: true });
        await fs.mkdir(path.join(root, 'Concepts'), { recursive: true });
        await fs.mkdir(path.join(root, '.obsidian'), { recursive: true });
        await fs.writeFile(path.join(root, '.obsidian', 'workspace.md'), '# Hidden\n');
        await fs.writeFile(path.join(root, 'INDEX.md'), '# Vault\n\n[[Projects/Alpha|Alpha]]\n');
        await fs.writeFile(
            path.join(root, 'Projects', 'Alpha.md'),
            [
                '---',
                'title: Alpha Project',
                'tags: [ads, launch]',
                'aliases:',
                '  - alpha brief',
                '---',
                '',
                '# Alpha Project',
                '',
                'Tracks lattice work. See [[Concepts/Lattice|Lattice]].',
                '',
            ].join('\n')
        );
        await fs.writeFile(
            path.join(root, 'Concepts', 'Lattice.md'),
            '# Lattice\n\nBack to [[Alpha Project]].\n'
        );
    });

    afterEach(async () => {
        closeDb();
        restoreEnv('TAVERN_VAULT_PATH', previousVaultPath);
        await fs.rm(root, { force: true, recursive: true });
    });

    test('reports Vault status from the configured root', async () => {
        await expect(getVaultStatus()).resolves.toMatchObject({
            configSource: 'environment',
            indexExists: true,
            pageCount: 3,
            readable: true,
            vaultPath: root,
            writable: true,
        });
    });

    test('lists Markdown pages without dot-directory files', async () => {
        const list = await listVaultPages();

        expect(list.pages.map((page) => page.path).sort()).toEqual([
            'Concepts/Lattice.md',
            'INDEX.md',
            'Projects/Alpha.md',
        ]);
    });

    test('reads a Vault page with frontmatter and links', async () => {
        const page = await getVaultPage({ path: 'Projects/Alpha.md' });

        expect(page).toMatchObject({
            body: expect.stringContaining('Tracks lattice work.'),
            frontmatter: {
                aliases: ['alpha brief'],
                tags: ['ads', 'launch'],
                title: 'Alpha Project',
            },
            links: [{ label: 'Lattice', target: 'Concepts/Lattice' }],
            path: 'Projects/Alpha.md',
            title: 'Alpha Project',
            vaultPath: root,
        });
    });

    test('searches title, frontmatter, path, and body text', async () => {
        await expect(
            searchVault({ limit: 10, offset: 0, query: 'alpha brief' })
        ).resolves.toMatchObject({
            hits: [{ page: { path: 'Projects/Alpha.md' } }],
            totalHitCount: 1,
        });

        await expect(
            searchVault({ limit: 10, offset: 0, query: 'lattice' })
        ).resolves.toMatchObject({
            hits: expect.arrayContaining([
                expect.objectContaining({
                    page: expect.objectContaining({ path: 'Concepts/Lattice.md' }),
                }),
                expect.objectContaining({
                    page: expect.objectContaining({ path: 'Projects/Alpha.md' }),
                }),
            ]),
        });
    });

    test('derives backlinks from wikilinks', async () => {
        await expect(listVaultBacklinks({ path: 'Projects/Alpha.md' })).resolves.toMatchObject({
            links: [
                { fromPath: 'Concepts/Lattice.md', fromTitle: 'Lattice' },
                { fromPath: 'INDEX.md', fromTitle: 'Vault' },
            ],
            targetPath: 'Projects/Alpha.md',
        });
    });

    test('rejects path traversal outside the Vault root', async () => {
        await expect(getVaultPage({ path: '../outside.md' })).resolves.toBeNull();
    });

    test('saves a settings-backed Vault path and creates INDEX.md', async () => {
        restoreEnv('TAVERN_VAULT_PATH', previousVaultPath);
        const nextRoot = path.join(root, 'saved-vault');

        await expect(saveVaultSettings({ vaultPath: nextRoot })).resolves.toMatchObject({
            configSource: 'settings',
            configuredPath: nextRoot,
            effectivePath: nextRoot,
        });
        await expect(getVaultSettings()).resolves.toMatchObject({
            configSource: 'settings',
            effectivePath: nextRoot,
        });
        await expect(fs.readFile(path.join(nextRoot, 'INDEX.md'), 'utf8')).resolves.toBe(
            '# Vault\n'
        );
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
        return;
    }
    process.env[key] = value;
}
