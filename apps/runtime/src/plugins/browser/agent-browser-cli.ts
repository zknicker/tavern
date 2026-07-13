import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { browserHome } from './service.ts';

// agent-browser owns the browser-automation command vocabulary; Tavern only
// forwards opaque argument arrays at the pinned session against the managed
// Chrome's CDP endpoint.
const agentBrowserSession = 'tavern';
const commandTimeoutMs = 180_000;

export interface AgentBrowserResult {
    exitCode: number;
    ok: boolean;
    stderr: string;
    stdout: string;
}

export interface AgentBrowserRunner {
    run(cdpPort: number, args: string[]): Promise<AgentBrowserResult>;
}

// agent-browser ships a native binary behind a thin JS launcher, so it stays
// outside the single-file Runtime bundle. Dev resolves the workspace
// dependency; the packaged Runtime resolves the copy staged under
// `share/tavern/node_modules` by the release artifact build (the same shape
// as the Wiki recall engine).
export function resolveAgentBrowserEntrypoint(): string {
    try {
        const packageJsonPath = require.resolve('agent-browser/package.json');
        return path.join(path.dirname(packageJsonPath), 'bin', 'agent-browser.js');
    } catch {
        return path.join(
            path.dirname(process.execPath),
            '..',
            'share',
            'tavern',
            'node_modules',
            'agent-browser',
            'bin',
            'agent-browser.js'
        );
    }
}

export class SystemAgentBrowserRunner implements AgentBrowserRunner {
    // Every forwarded command re-attaches to the current CDP endpoint first:
    // the managed Chrome may have restarted since the session last connected.
    async run(cdpPort: number, args: string[]): Promise<AgentBrowserResult> {
        const entrypoint = resolveAgentBrowserEntrypoint();
        const configPath = writeNeutralAgentBrowserConfig();
        const sessionArgs = ['--session', agentBrowserSession, '--config', configPath];

        const connect = await execAgentBrowser(entrypoint, [
            ...sessionArgs,
            'connect',
            String(cdpPort),
        ]);
        if (!connect.ok) {
            return connect;
        }
        return await execAgentBrowser(entrypoint, [...sessionArgs, ...args]);
    }
}

// A pinned empty config neutralizes agent-browser's own user/project config
// discovery so stray launch settings can never spawn a competing Chrome.
function writeNeutralAgentBrowserConfig(): string {
    const configPath = path.join(browserHome(), 'agent-browser.json');
    fs.mkdirSync(path.dirname(configPath), { mode: 0o700, recursive: true });
    fs.writeFileSync(configPath, '{}\n', { mode: 0o600 });
    return configPath;
}

function execAgentBrowser(entrypoint: string, args: string[]): Promise<AgentBrowserResult> {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [entrypoint, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const timer = setTimeout(() => {
            stderr += `\nagent-browser command timed out after ${commandTimeoutMs / 1000}s.`;
            child.kill('SIGKILL');
        }, commandTimeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        const settle = (exitCode: number) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({
                exitCode,
                ok: exitCode === 0,
                stderr: stderr.trim(),
                stdout: stdout.trim(),
            });
        };
        child.on('error', (error) => {
            stderr += `\n${error.message}`;
            settle(1);
        });
        child.on('close', (code) => {
            settle(code ?? 1);
        });
    });
}
