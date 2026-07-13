import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalTrustedSandboxProvider } from './local-trusted-sandbox.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe('local trusted sandbox provider', () => {
    it('exposes the workspace contract required by bridge-backed harnesses', async () => {
        const rootDir = await tempRoot();
        const provider = createLocalTrustedSandboxProvider({ rootDir });
        const session = await provider.createSession({ sessionId: 'ags_test' });

        expect(session.id).toBe('ags_test');
        expect(session.defaultWorkingDirectory).toBe(rootDir);
        expect(session.ports[0]).toBeGreaterThan(0);
        await expect(
            session.getPortUrl({ port: session.ports[0] ?? 0, protocol: 'ws' })
        ).resolves.toBe(`ws://127.0.0.1:${session.ports[0]}`);

        await session.writeTextFile({
            content: ['one', 'two', 'three'].join('\n'),
            path: 'nested/file.txt',
        });
        await expect(
            session.readTextFile({ endLine: 2, path: 'nested/file.txt', startLine: 2 })
        ).resolves.toBe('two');

        const result = await session.run({ command: 'printf sandbox-ok' });
        expect(result).toMatchObject({
            exitCode: 0,
            stderr: '',
            stdout: 'sandbox-ok',
        });

        const restricted = session.restricted();
        await expect(
            restricted.run({
                command: 'printf restricted-ok',
                workingDirectory: path.join(rootDir, 'nested'),
            })
        ).resolves.toMatchObject({
            exitCode: 0,
            stdout: 'restricted-ok',
        });
        await session.stop();
    });

    it('can seed Codex auth into an isolated workspace home without copying host config', async () => {
        const rootDir = await tempRoot();
        const hostHomeDir = await tempRoot();
        await mkdir(path.join(hostHomeDir, '.codex'), { recursive: true });
        await writeFile(path.join(hostHomeDir, '.codex', 'auth.json'), '{"kind":"test"}');
        await writeFile(
            path.join(hostHomeDir, '.codex', 'config.toml'),
            'service_tier = "priority"'
        );
        const homeDir = path.join(rootDir, '.home');
        const provider = createLocalTrustedSandboxProvider({
            authProfiles: ['codex'],
            env: {
                CODEX_HOME: path.join(homeDir, '.codex'),
                HOME: homeDir,
            },
            hostHomeDir,
            rootDir,
        });
        const session = await provider.createSession({ sessionId: 'ags_codex' });

        await expect(
            session.run({ command: 'printf "%s|%s" "$HOME" "$CODEX_HOME"' })
        ).resolves.toMatchObject({
            exitCode: 0,
            stdout: `${homeDir}|${path.join(homeDir, '.codex')}`,
        });
        await expect(readFile(path.join(homeDir, '.codex', 'auth.json'), 'utf8')).resolves.toBe(
            '{"kind":"test"}'
        );
        // The workspace config.toml is Tavern-authored, never the host's.
        const workspaceConfig = await readFile(path.join(homeDir, '.codex', 'config.toml'), 'utf8');
        expect(workspaceConfig).not.toContain('service_tier');
        expect(workspaceConfig).toContain('image_generation = false');
        await session.stop();
    });
});

async function tempRoot() {
    const root = await mkdtemp(path.join(tmpdir(), 'tavern-local-trusted-sandbox-'));
    roots.push(root);
    return root;
}
