import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMnemosyneInstallArgs, resolveHermesPythonPath } from './mnemosyne.ts';
import { managedMnemosynePluginSource } from './mnemosyne-shim.ts';

describe('managed Mnemosyne provisioning', () => {
    it('resolves Hermes Python from a venv bin executable', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-python-'));
        const binPath = path.join(directory, 'venv', 'bin');
        await writeExecutable(path.join(binPath, 'hermes'));
        await writeExecutable(path.join(binPath, 'python'));

        await expect(resolveHermesPythonPath(path.join(binPath, 'hermes'))).resolves.toBe(
            path.join(binPath, 'python')
        );
    });

    it('resolves Hermes Python from the official launcher wrapper', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-python-'));
        const launcherPath = path.join(directory, '.local', 'bin', 'hermes');
        const hermesPath = path.join(directory, '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes');
        const pythonPath = path.join(directory, '.hermes', 'hermes-agent', 'venv', 'bin', 'python');
        await writeExecutable(hermesPath);
        await writeExecutable(pythonPath);
        await writeExecutable(
            launcherPath,
            ['#!/usr/bin/env bash', 'unset PYTHONPATH', `exec "${hermesPath}" "$@"`, ''].join('\n')
        );

        await expect(resolveHermesPythonPath(launcherPath)).resolves.toBe(pythonPath);
    });

    it('prefers an explicit TAVERN_HERMES_PYTHON_BIN override over inference', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-python-'));
        const overridePython = path.join(directory, 'custom', 'python');
        await writeExecutable(path.join(directory, 'bin', 'hermes'));
        await writeExecutable(overridePython);

        process.env.TAVERN_HERMES_PYTHON_BIN = overridePython;
        try {
            await expect(
                resolveHermesPythonPath(path.join(directory, 'bin', 'hermes'))
            ).resolves.toBe(overridePython);
        } finally {
            process.env.TAVERN_HERMES_PYTHON_BIN = undefined;
        }
    });

    it('returns null when no Python interpreter is found', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-python-'));
        await writeExecutable(path.join(directory, 'bin', 'hermes'));

        await expect(resolveHermesPythonPath(path.join(directory, 'bin', 'hermes'))).resolves.toBe(
            null
        );
    });

    it('prefers a bundled wheelhouse for package installation', () => {
        expect(
            buildMnemosyneInstallArgs({
                packageSpec: 'mnemosyne-hermes==0.1.5',
                wheelhousePath: '/runtime-assets/python/mnemosyne',
            })
        ).toEqual([
            '-m',
            'pip',
            'install',
            '--disable-pip-version-check',
            '--upgrade',
            '--no-index',
            '--find-links',
            '/runtime-assets/python/mnemosyne',
            'mnemosyne-hermes==0.1.5',
        ]);
    });

    it('aliases provider tool names to product memory names', () => {
        expect(managedMnemosynePluginSource).toContain('PRODUCT_TOOL_PREFIX = "memory_"');
        expect(managedMnemosynePluginSource).toContain('TOOL_PREFIX = "mnemosyne_"');
        expect(managedMnemosynePluginSource).toContain('TavernMnemosyneMemoryProvider');
        expect(managedMnemosynePluginSource).toContain('_to_provider_tool_name(tool_name)');
    });
});

async function writeExecutable(filePath: string, content = '#!/usr/bin/env bash\n') {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    await fs.chmod(filePath, 0o755);
}
