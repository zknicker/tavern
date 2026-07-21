import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime config paths', () => {
    const originalHome = process.env.HOME;
    const originalAgentHome = process.env.TAVERN_AGENT_HOME;
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-config-home-'));
        process.env.HOME = home;
        process.env.TAVERN_RUNTIME_ROOT = path.join(home, 'runtime');
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('HOME', originalHome);
        restoreEnv('TAVERN_AGENT_HOME', originalAgentHome);
        restoreEnv('TAVERN_RUNTIME_ROOT', originalRuntimeRoot);
        vi.resetModules();
        await fs.rm(home, { force: true, recursive: true });
    });

    it('expands a configured agent home path under the user home', async () => {
        process.env.TAVERN_AGENT_HOME = '~/.grotto/runtime/agent';
        vi.resetModules();

        const config = await import('./config');

        expect(config.AGENT_HOME).toBe(path.join(home, '.grotto', 'runtime', 'agent'));
    });

    it('uses the user runtime root for source runs by default', async () => {
        // biome-ignore lint/performance/noDelete: assigning undefined to process.env coerces to the string "undefined"; delete is the only way to unset.
        delete process.env.TAVERN_RUNTIME_ROOT;
        process.argv[1] = path.join(home, 'repo', 'apps', 'runtime', 'src', 'index.ts');
        vi.resetModules();

        const config = await import('./config');

        expect(config.RUNTIME_ROOT).toBe(path.join(home, '.grotto', 'runtime'));
    });
});

describe('runtime API token (grotto.json)', () => {
    const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
    const originalToken = process.env.TAVERN_RUNTIME_TOKEN;
    let runtimeRoot: string;
    let configPath: string;

    beforeEach(async () => {
        runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-config-token-'));
        configPath = path.join(runtimeRoot, 'grotto.json');
        process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
        // biome-ignore lint/performance/noDelete: assigning undefined to process.env coerces to the string "undefined"; delete is the only way to unset.
        delete process.env.TAVERN_RUNTIME_TOKEN;
        vi.resetModules();
    });

    afterEach(async () => {
        restoreEnv('TAVERN_RUNTIME_ROOT', originalRuntimeRoot);
        restoreEnv('TAVERN_RUNTIME_TOKEN', originalToken);
        vi.resetModules();
        await fs.rm(runtimeRoot, { force: true, recursive: true });
    });

    it('generates a token into grotto.json on first call and returns it on the next', async () => {
        const config = await import('./config');

        const token = config.getRuntimeApiToken();
        const persisted = JSON.parse(await fs.readFile(configPath, 'utf8'));

        expect(persisted.token).toBe(token);
        expect(token.length).toBeGreaterThan(20);
        expect(config.getRuntimeApiToken()).toBe(token);
    });

    it('reads an existing token from grotto.json', async () => {
        await fs.writeFile(configPath, `${JSON.stringify({ token: 'persisted-token' })}\n`);
        const config = await import('./config');

        expect(config.getRuntimeApiToken()).toBe('persisted-token');
    });

    it('preserves unknown config keys when adding a token', async () => {
        await fs.writeFile(configPath, `${JSON.stringify({ operatorNote: 'keep me' })}\n`);
        const config = await import('./config');

        const token = config.getRuntimeApiToken();
        const persisted = JSON.parse(await fs.readFile(configPath, 'utf8'));

        expect(persisted.operatorNote).toBe('keep me');
        expect(persisted.token).toBe(token);
    });

    it('prefers the TAVERN_RUNTIME_TOKEN env override and leaves grotto.json alone', async () => {
        process.env.TAVERN_RUNTIME_TOKEN = 'env-token';
        vi.resetModules();
        const config = await import('./config');

        expect(config.getRuntimeApiToken()).toBe('env-token');
        await expect(fs.access(configPath)).rejects.toThrow();
    });

    it('throws on unparseable grotto.json instead of clobbering it', async () => {
        await fs.writeFile(configPath, '{ not json');
        const config = await import('./config');

        expect(() => config.getRuntimeApiToken()).toThrow(/not valid JSON/);
        expect(await fs.readFile(configPath, 'utf8')).toBe('{ not json');
    });
});

function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }

    process.env[name] = value;
}
