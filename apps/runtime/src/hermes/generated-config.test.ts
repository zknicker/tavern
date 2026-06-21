import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { mergeHermesGeneratedConfig } from './generated-config';

const emptyExecution = {
    compression: null,
    fallbackModels: [],
    subagentEffort: null,
    subagentModel: null,
    timezone: null,
};
const emptyConnectors = { servers: {}, staleIds: [] };
const codexModel = {
    apiKey: null,
    baseUrl: null,
    model: 'gpt-5.4-mini',
    provider: 'openai-codex',
};

async function tempConfigPath() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-hermes-config-'));
    return path.join(directory, 'config.yaml');
}

async function readConfig(configPath: string) {
    return parseDocument(await fs.readFile(configPath, 'utf8'));
}

describe('generated Hermes config composer', () => {
    it('produces the exact generated document from an empty file', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: {
                ...emptyExecution,
                fallbackModels: [
                    { model: 'kimi-k2.5', provider: 'openrouter' },
                    { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
                ],
                timezone: 'America/New_York',
            },
            model: codexModel,
            permissions: null,
        });

        expect((await readConfig(configPath)).toJS()).toEqual({
            cron: {
                wrap_response: false,
            },
            display: {
                interim_assistant_messages: true,
                tool_progress: 'all',
            },
            fallback_providers: [
                { model: 'kimi-k2.5', provider: 'openrouter' },
                { base_url: 'http://127.0.0.1:1234/v1', model: 'local', provider: 'custom' },
            ],
            memory: {
                memory_enabled: false,
                mnemosyne: {
                    auto_sleep: true,
                    ignore_patterns: [
                        '^Traceback \\(most recent call last\\)',
                        '^Error:',
                        '^\\s+at ',
                    ],
                    sleep_threshold: 20,
                },
                provider: 'mnemosyne',
                user_profile_enabled: false,
            },
            model: {
                default: 'gpt-5.4-mini',
                provider: 'openai-codex',
            },
            plugins: {
                enabled: ['tavern-messenger-platform'],
            },
            timezone: 'America/New_York',
        });
    });

    it('preserves operator-managed keys while setting the model route', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            [
                'gateway:',
                '  bind: loopback',
                'cron:',
                '  script_timeout_seconds: 45',
                '  wrap_response: true',
                'model:',
                '  default: old-model',
                '  provider: old-provider',
                'memory:',
                '  memory_char_limit: 2200',
                '  user_char_limit: 1375',
                '',
            ].join('\n')
        );

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['gateway', 'bind'])).toBe('loopback');
        expect(doc.getIn(['cron', 'script_timeout_seconds'])).toBe(45);
        expect(doc.getIn(['cron', 'wrap_response'])).toBe(false);
        expect(doc.getIn(['display', 'tool_progress'])).toBe('all');
        expect(doc.getIn(['display', 'interim_assistant_messages'])).toBe(true);
        expect(doc.getIn(['model', 'default'])).toBe('gpt-5.4-mini');
        expect(doc.getIn(['model', 'provider'])).toBe('openai-codex');
        expect(doc.getIn(['model', 'base_url'])).toBeUndefined();
        expect(doc.getIn(['model', 'api_key'])).toBeUndefined();
        expect(doc.getIn(['memory', 'provider'])).toBe('mnemosyne');
        expect(doc.getIn(['memory', 'memory_enabled'])).toBe(false);
        expect(doc.getIn(['memory', 'user_profile_enabled'])).toBe(false);
        expect(doc.getIn(['memory', 'memory_char_limit'])).toBeUndefined();
        expect(doc.getIn(['memory', 'user_char_limit'])).toBeUndefined();
        expect(doc.getIn(['memory', 'mnemosyne', 'auto_sleep'])).toBe(true);
        expect(doc.getIn(['memory', 'mnemosyne', 'sleep_threshold'])).toBe(20);
        expect(doc.has('fallback_providers')).toBe(false);
        expect(doc.has('timezone')).toBe(false);
    });

    it('omits the model route when Runtime has no runnable provider', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: {
                apiKey: null,
                baseUrl: null,
                model: null,
                provider: null,
            },
            permissions: null,
        });

        const doc = await readConfig(configPath);
        expect(doc.has('model')).toBe(false);
        expect(doc.getIn(['memory', 'provider'])).toBe('mnemosyne');
    });

    it('writes a custom provider base URL for local Hermes e2e runs', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: {
                apiKey: 'tavern-e2e-mock-key',
                baseUrl: 'http://127.0.0.1:44080/v1',
                model: 'tavern-e2e-tools',
                provider: 'custom',
            },
            permissions: null,
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['model', 'default'])).toBe('tavern-e2e-tools');
        expect(doc.getIn(['model', 'provider'])).toBe('custom');
        expect(doc.getIn(['model', 'base_url'])).toBe('http://127.0.0.1:44080/v1');
        expect(doc.getIn(['model', 'api_key'])).toBe('tavern-e2e-mock-key');
    });

    it('removes execution keys when fallbacks and timezone are cleared', async () => {
        const configPath = await tempConfigPath();
        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: {
                ...emptyExecution,
                fallbackModels: [{ model: 'kimi-k2.5', provider: 'openrouter' }],
                timezone: 'Europe/Berlin',
            },
            model: codexModel,
            permissions: null,
        });

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        const doc = await readConfig(configPath);
        expect(doc.has('fallback_providers')).toBe(false);
        expect(doc.has('timezone')).toBe(false);
    });

    it('writes subagent defaults and compression, and clears delegation when inherited', async () => {
        const configPath = await tempConfigPath();
        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: {
                ...emptyExecution,
                compression: { enabled: true, protectLastMessages: 30, thresholdPercent: 70 },
                subagentEffort: 'high',
                subagentModel: { model: 'claude-haiku-4-5', provider: 'anthropic' },
            },
            model: codexModel,
            permissions: null,
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['delegation', 'model'])).toBe('claude-haiku-4-5');
        expect(doc.getIn(['delegation', 'provider'])).toBe('anthropic');
        expect(doc.getIn(['delegation', 'reasoning_effort'])).toBe('high');
        expect(doc.getIn(['compression', 'enabled'])).toBe(true);
        expect(doc.getIn(['compression', 'threshold'])).toBe(0.7);
        expect(doc.getIn(['compression', 'protect_last_n'])).toBe(30);

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        const cleared = await readConfig(configPath);
        expect(cleared.getIn(['delegation', 'model'])).toBeUndefined();
        expect(cleared.getIn(['delegation', 'reasoning_effort'])).toBeUndefined();
        expect(cleared.getIn(['compression', 'enabled'])).toBeUndefined();
        expect(cleared.getIn(['compression', 'threshold'])).toBeUndefined();
    });

    it('writes configured permissions with product-to-engine mode mapping', async () => {
        const configPath = await tempConfigPath();

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: {
                approvalMode: 'ask',
                automationApprovalMode: 'allow',
                commandAllowlist: ['rm -rf /tmp/scratch', 'git push --force'],
            },
        });

        const doc = await readConfig(configPath);
        expect(doc.getIn(['approvals', 'mode'])).toBe('manual');
        expect(doc.getIn(['approvals', 'cron_mode'])).toBe('allow');
        expect((doc.toJS() as { command_allowlist: string[] }).command_allowlist).toEqual([
            'rm -rf /tmp/scratch',
            'git push --force',
        ]);
    });

    it('removes the allowlist key when cleared and leaves approvals untouched when unconfigured', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            ['approvals:', '  mode: allow', 'command_allowlist:', '  - operator-entry', ''].join(
                '\n'
            )
        );

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });
        const untouched = await readConfig(configPath);
        expect(untouched.getIn(['approvals', 'mode'])).toBe('allow');
        expect(untouched.has('command_allowlist')).toBe(true);

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: {
                approvalMode: 'deny',
                automationApprovalMode: 'deny',
                commandAllowlist: [],
            },
        });
        const cleared = await readConfig(configPath);
        expect(cleared.getIn(['approvals', 'mode'])).toBe('deny');
        expect(cleared.has('command_allowlist')).toBe(false);
    });

    it('manages only Tavern connector entries under mcp_servers', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            ['mcp_servers:', '  operator-server:', '    command: operator-cmd', ''].join('\n')
        );

        await mergeHermesGeneratedConfig(configPath, {
            connectors: {
                servers: {
                    'github-tools': {
                        args: ['mcp-server'],
                        command: 'github',
                        env: { GITHUB_TOKEN: envRef('TAVERN_MCP_GITHUB_TOOLS_ENV_GITHUB_TOKEN') },
                        timeout: 30,
                    },
                },
                staleIds: ['removed-connector'],
            },
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        const config = (await readConfig(configPath)).toJS() as {
            mcp_servers: Record<string, unknown>;
        };
        expect(config.mcp_servers['operator-server']).toEqual({ command: 'operator-cmd' });
        expect(config.mcp_servers['github-tools']).toEqual({
            args: ['mcp-server'],
            command: 'github',
            env: { GITHUB_TOKEN: envRef('TAVERN_MCP_GITHUB_TOOLS_ENV_GITHUB_TOKEN') },
            timeout: 30,
        });
        expect(config.mcp_servers['removed-connector']).toBeUndefined();
    });

    it('drops the mcp_servers key when the last managed entry is removed', async () => {
        const configPath = await tempConfigPath();
        await mergeHermesGeneratedConfig(configPath, {
            connectors: { servers: { solo: { url: 'https://mcp.example.com' } }, staleIds: [] },
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        await mergeHermesGeneratedConfig(configPath, {
            connectors: { servers: {}, staleIds: ['solo'] },
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        expect((await readConfig(configPath)).has('mcp_servers')).toBe(false);
    });

    it('keeps an existing plugins list and appends the messenger plugin once', async () => {
        const configPath = await tempConfigPath();
        await fs.writeFile(
            configPath,
            ['plugins:', '  enabled:', '    - custom-plugin', ''].join('\n')
        );

        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });
        await mergeHermesGeneratedConfig(configPath, {
            connectors: emptyConnectors,
            execution: emptyExecution,
            model: codexModel,
            permissions: null,
        });

        const config = (await readConfig(configPath)).toJS() as {
            plugins: { enabled: string[] };
        };
        expect(config.plugins.enabled).toEqual(['custom-plugin', 'tavern-messenger-platform']);
    });
});

function envRef(name: string) {
    return ['${', name, '}'].join('');
}
