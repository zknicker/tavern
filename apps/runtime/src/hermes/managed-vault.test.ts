import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    prepareManagedVaultIntegration,
    resolveManagedVaultPath,
    resolveRuntimeAssetsRoot,
} from './managed-vault.ts';

describe('managed Vault integration', () => {
    it('materializes the managed skill and Vault root', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-managed-vault-'));
        const assetsRoot = path.join(directory, 'assets');
        const hermesHome = path.join(directory, 'hermes-home');
        const vaultPath = path.join(directory, 'wiki');
        const sourceSkill = path.join(assetsRoot, 'hermes', 'skills', 'vault');
        const previousVaultPath = process.env.TAVERN_VAULT_PATH;

        try {
            process.env.TAVERN_VAULT_PATH = vaultPath;
            await writeFile(
                path.join(sourceSkill, 'SKILL.md'),
                '---\nname: vault\n---\n\nVault body.\n'
            );

            const integration = await prepareManagedVaultIntegration({
                assetsRoot,
                hermesHome,
            });

            await expect(
                fs.readFile(path.join(integration.skillPath, 'SKILL.md'), 'utf8')
            ).resolves.toContain('Vault body.');
            await expectOwnerWriteDisabled(integration.skillPath);
            await expectOwnerWriteDisabled(path.join(integration.skillPath, 'SKILL.md'));
            await expect(
                fs.readFile(path.join(integration.vaultPath, 'INDEX.md'), 'utf8')
            ).resolves.toBe('# Vault\n');
            expect(integration.vaultPath).toBe(vaultPath);

            await expect(
                prepareManagedVaultIntegration({ assetsRoot, hermesHome })
            ).resolves.toMatchObject({ skillPath: integration.skillPath });
        } finally {
            restoreEnv('TAVERN_VAULT_PATH', previousVaultPath);
            await removeWritable(directory);
        }
    });

    it('resolves the configured Vault path', () => {
        const previousVaultPath = process.env.TAVERN_VAULT_PATH;
        try {
            process.env.TAVERN_VAULT_PATH = '/tmp/tavern-vault-test';

            expect(resolveManagedVaultPath()).toBe('/tmp/tavern-vault-test');
        } finally {
            restoreEnv('TAVERN_VAULT_PATH', previousVaultPath);
        }
    });

    it('finds repo runtime assets from source execution', () => {
        const previousAssetsDir = process.env.TAVERN_RUNTIME_ASSETS_DIR;
        try {
            process.env.TAVERN_RUNTIME_ASSETS_DIR = undefined;

            expect(resolveRuntimeAssetsRoot()).toMatch(/apps\/runtime\/assets$/u);
        } finally {
            restoreEnv('TAVERN_RUNTIME_ASSETS_DIR', previousAssetsDir);
        }
    });

    it('names Vault in the bundled skill trigger metadata', async () => {
        const skill = await fs.readFile(
            path.join(resolveRuntimeAssetsRoot(), 'hermes', 'skills', 'vault', 'SKILL.md'),
            'utf8'
        );

        expect(skill).toContain('name: vault');
        expect(skill).toContain('Managed by Tavern Runtime');
        expect(skill).toContain('Vault is the user');
        expect(skill).toContain('Use `TAVERN_VAULT_PATH`');
    });
});

async function expectOwnerWriteDisabled(filePath: string) {
    const mode = (await fs.stat(filePath)).mode;
    expect(mode & 0o200).toBe(0);
}

async function removeWritable(filePath: string) {
    await makeWritable(filePath);
    await fs.rm(filePath, { force: true, recursive: true });
}

async function makeWritable(filePath: string) {
    const stats = await fs.lstat(filePath).catch(() => null);
    if (!stats || stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        await fs.chmod(filePath, 0o700).catch(() => undefined);
        await Promise.all(
            (await fs.readdir(filePath)).map((entry) => makeWritable(path.join(filePath, entry)))
        );
        return;
    }

    await fs.chmod(filePath, 0o600).catch(() => undefined);
}

async function writeFile(filePath: string, content: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
        return;
    }
    process.env[key] = value;
}
