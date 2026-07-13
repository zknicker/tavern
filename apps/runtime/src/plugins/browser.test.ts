import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { readPluginSkillBundlesForAgent } from './agent-capabilities';
import {
    checkBrowserCapability,
    getBrowserPlugin,
    getBrowserSettings,
    saveBrowserSettings,
} from './browser';
import type { AgentBrowserResult } from './browser/agent-browser-cli.ts';
import { stopBrowserService } from './browser/service.ts';
import { createBrowserToolsForAgent } from './browser-tools';
import { handlePluginsRequest } from './routes';

const detectionMock = vi.hoisted(() => ({
    detect: vi.fn(),
}));

vi.mock('./browser/chrome-detection.ts', () => ({
    detectChromeApplications: detectionMock.detect,
}));

const chromeApplication = {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path: '/Applications/Google Chrome.app',
    version: '149.0.0.0',
};

function agentWithPlugins(pluginIds: string[]) {
    return {
        enabledPluginIds: pluginIds,
        id: 'agent-1',
        name: 'Agent',
    } as Parameters<typeof createBrowserToolsForAgent>[0];
}

beforeEach(() => {
    detectionMock.detect.mockReset();
    detectionMock.detect.mockResolvedValue([]);
    ensureRuntimeSchema(initTestDb());
});

afterEach(() => {
    stopBrowserService();
    closeDb();
});

describe('Browser Plugin settings', () => {
    test('defaults to disabled with the default profile name', async () => {
        expect(await getBrowserSettings()).toMatchObject({
            application: null,
            enabled: false,
            profileName: 'default',
            status: null,
        });
    });

    test('persists the profile name and reports detected Chrome', async () => {
        detectionMock.detect.mockResolvedValue([chromeApplication]);
        const settings = await saveBrowserSettings({ profileName: 'agent-two' });
        expect(settings).toMatchObject({
            application: { path: chromeApplication.path, version: '149.0.0.0' },
            enabled: false,
            profileName: 'agent-two',
        });
        expect(getBrowserPlugin()).toMatchObject({
            config: { profileName: 'agent-two' },
            enabled: false,
            id: 'browser',
        });
    });

    test('rejects profile names that are not slugs', async () => {
        await expect(saveBrowserSettings({ profileName: 'Bad Name!' })).rejects.toThrow();
    });

    test('keeps the stored profile name when the Plugin is disabled', async () => {
        await saveBrowserSettings({ profileName: 'durable-profile' });
        await saveBrowserSettings({ enabled: false });
        expect((await getBrowserSettings()).profileName).toBe('durable-profile');
    });

    test('serves and updates settings over the plugins routes', async () => {
        detectionMock.detect.mockResolvedValue([chromeApplication]);
        const read = await handlePluginsRequest(
            new Request('http://runtime.test/plugins/browser/settings')
        );
        expect(read?.status).toBe(200);
        expect(await read?.json()).toMatchObject({ enabled: false, profileName: 'default' });

        const forbidden = await handlePluginsRequest(
            new Request('http://runtime.test/plugins/browser/settings', {
                body: JSON.stringify({ profileName: 'ops' }),
                method: 'PUT',
            })
        );
        expect(forbidden?.status).toBe(403);

        const updated = await handlePluginsRequest(
            new Request('http://runtime.test/plugins/browser/settings', {
                body: JSON.stringify({ profileName: 'ops' }),
                headers: {
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );
        expect(updated?.status).toBe(200);
        expect(await updated?.json()).toMatchObject({ profileName: 'ops' });
    });

    test('lists Browser in the runtime plugin inventory', async () => {
        const response = await handlePluginsRequest(new Request('http://runtime.test/plugins'));
        const payload = (await response?.json()) as { plugins: Array<{ id: string }> };
        expect(payload.plugins.map((plugin) => plugin.id)).toContain('browser');
    });
});

describe('Browser capability health', () => {
    test('is unavailable while the Plugin is disabled', async () => {
        expect(await checkBrowserCapability()).toMatchObject({
            reason: 'Browser is disabled.',
            state: 'unavailable',
        });
    });

    test('names the missing Chrome installation directly', async () => {
        await saveBrowserSettings({ enabled: true });
        expect(await checkBrowserCapability()).toMatchObject({
            reason: 'Install Google Chrome to enable Browser.',
            state: 'unavailable',
        });
    });
});

describe('Browser managed skill', () => {
    let skillsDir: string;

    beforeEach(() => {
        skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tavern-skills-'));
    });

    afterEach(() => {
        fs.rmSync(skillsDir, { force: true, recursive: true });
    });

    test('is materialized for granted agents only', async () => {
        await saveBrowserSettings({ enabled: true });
        const granted = await readPluginSkillBundlesForAgent(agentWithPlugins(['browser']), {
            skillsDir,
        });
        expect(granted.map((bundle) => bundle.id)).toContain('browser');

        const ungranted = await readPluginSkillBundlesForAgent(agentWithPlugins([]), {
            skillsDir,
        });
        expect(ungranted.map((bundle) => bundle.id)).not.toContain('browser');
    });

    test('is omitted while the Plugin is disabled', async () => {
        const bundles = await readPluginSkillBundlesForAgent(agentWithPlugins(['browser']), {
            skillsDir,
        });
        expect(bundles.map((bundle) => bundle.id)).not.toContain('browser');
    });

    test('preserves upstream vocabulary and teaches only the browser tool surface', async () => {
        await saveBrowserSettings({ enabled: true });
        const bundles = await readPluginSkillBundlesForAgent(agentWithPlugins(['browser']), {
            skillsDir,
        });
        const skill = bundles.find((bundle) => bundle.id === 'browser');
        const content = skill?.content ?? '';

        // Upstream agent-browser vocabulary stays intact.
        expect(content).toContain('snapshot -i');
        expect(content).toContain('@e1');
        expect(content).toContain('wait --load networkidle');
        expect(content).toContain('screenshot');

        // The invocation surface is Tavern's browser tool, not a CLI launch.
        expect(content).toContain('one `browser` tool');
        expect(content).not.toContain('npm i -g');
        expect(content).not.toContain('--cdp');
        expect(content).not.toContain('--session');
        expect(content).not.toContain('eval --stdin');
    });
});

describe('Browser tool gating', () => {
    const runner = {
        run: vi.fn(
            (): Promise<AgentBrowserResult> =>
                Promise.resolve({ exitCode: 0, ok: true, stderr: '', stdout: 'done' })
        ),
    };

    test('is absent without a per-agent grant', async () => {
        await saveBrowserSettings({ enabled: true });
        expect(createBrowserToolsForAgent(agentWithPlugins([]), runner)).toEqual({});
        expect(createBrowserToolsForAgent(agentWithPlugins(['merchbase']), runner)).toEqual({});
    });

    test('is absent when the Plugin is disabled even with a grant', () => {
        expect(createBrowserToolsForAgent(agentWithPlugins(['browser']), runner)).toEqual({});
    });

    test('materializes one browser tool for a granted agent', async () => {
        await saveBrowserSettings({ enabled: true });
        const tools = createBrowserToolsForAgent(agentWithPlugins(['browser']), runner);
        expect(Object.keys(tools)).toEqual(['browser']);
    });

    test('fails fast with the capability reason when supervision is not running', async () => {
        await saveBrowserSettings({ enabled: true });
        const tools = createBrowserToolsForAgent(agentWithPlugins(['browser']), runner);
        const browserTool = tools.browser as unknown as {
            execute: (
                input: { args: string[] },
                options: Record<string, unknown>
            ) => Promise<{ error?: string; ok: boolean }>;
        };
        const result = await browserTool.execute({ args: ['open', 'https://example.com'] }, {});
        expect(result.ok).toBe(false);
        expect(result.error).toBe('Install Google Chrome to enable Browser.');
        expect(runner.run).not.toHaveBeenCalled();
    });
});
