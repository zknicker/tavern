import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ensureCodexHomeConfig } from './codex-home-config.ts';

let codexHome: string;

beforeEach(async () => {
    codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-codex-home-'));
});

afterEach(async () => {
    await fs.rm(codexHome, { force: true, recursive: true });
});

test('writes the managed config into an empty CODEX_HOME', async () => {
    await ensureCodexHomeConfig(codexHome);

    const config = await fs.readFile(path.join(codexHome, 'config.toml'), 'utf8');
    expect(config).toContain('image_generation = false');
    expect(config).toContain('[[skills.config]]');
    expect(config).toContain(path.join(codexHome, 'skills', '.system', 'imagegen', 'SKILL.md'));
    expect(config).toContain('enabled = false');
});

test('appends the managed block without clobbering existing config', async () => {
    const configPath = path.join(codexHome, 'config.toml');
    await fs.writeFile(configPath, 'model = "gpt-5.5"\n', 'utf8');

    await ensureCodexHomeConfig(codexHome);

    const config = await fs.readFile(configPath, 'utf8');
    expect(config.startsWith('model = "gpt-5.5"')).toBe(true);
    expect(config).toContain('image_generation = false');
});

test('is idempotent across sessions', async () => {
    await ensureCodexHomeConfig(codexHome);
    const first = await fs.readFile(path.join(codexHome, 'config.toml'), 'utf8');

    await ensureCodexHomeConfig(codexHome);
    const second = await fs.readFile(path.join(codexHome, 'config.toml'), 'utf8');

    expect(second).toBe(first);
});
