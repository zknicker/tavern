import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    buildAgentToolEnvironment,
    resolveAgentCliEntrypoint,
    setAgentCliServerUrl,
} from './agent-cli-wrapper.ts';

const originalRuntimeRoot = process.env.TAVERN_RUNTIME_ROOT;
let runtimeRoot = '';

beforeEach(() => {
    runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grotto-agent-cli-'));
    process.env.TAVERN_RUNTIME_ROOT = runtimeRoot;
});

afterEach(() => {
    setAgentCliServerUrl(null);
    fs.rmSync(runtimeRoot, { force: true, recursive: true });
    if (originalRuntimeRoot === undefined) {
        Reflect.deleteProperty(process.env, 'TAVERN_RUNTIME_ROOT');
    } else {
        process.env.TAVERN_RUNTIME_ROOT = originalRuntimeRoot;
    }
});

describe('agent CLI wrapper', () => {
    test('materializes executable wrapper, token, and tool environment', () => {
        const result = buildAgentToolEnvironment('agt_wren', {
            entrypoint: { args: ['/app/src/index.ts'], executable: '/usr/local/bin/bun' },
            inheritedPath: '/usr/bin:/bin',
            serverUrl: 'http://127.0.0.1:18790',
        });

        expect(result.wrapperPath).toBe(path.join(runtimeRoot, 'agent-bin', 'agt_wren', 'grotto'));
        expect(fs.statSync(result.wrapperPath).mode & 0o777).toBe(0o755);
        expect(fs.statSync(result.tokenFile).mode & 0o777).toBe(0o600);
        const script = fs.readFileSync(result.wrapperPath, 'utf8');
        expect(script.startsWith('#!/bin/sh\n')).toBe(true);
        expect(script).toContain("export GROTTO_AGENT_ID='agt_wren'");
        expect(script).toContain("export GROTTO_SERVER_URL='http://127.0.0.1:18790'");
        expect(script).toContain(`export GROTTO_AGENT_TOKEN_FILE='${result.tokenFile}'`);
        // The harness observer parks a composition id per in-flight send; the
        // wrapper forwards it when present (I1).
        expect(script).toContain('GROTTO_COMPOSITION_ID=$(cat ');
        expect(script).toContain('export GROTTO_COMPOSITION_ID');
        expect(script.endsWith(`exec '/usr/local/bin/bun' '/app/src/index.ts' "$@"\n`)).toBe(true);
        expect(result.env).toEqual({
            GROTTO_AGENT_ID: 'agt_wren',
            GROTTO_AGENT_TOKEN_FILE: result.tokenFile,
            GROTTO_SERVER_URL: 'http://127.0.0.1:18790',
            PATH: `${result.binDir}${path.delimiter}/usr/bin:/bin`,
        });
    });

    test('accepts unprefixed agent ids — they are opaque in the public contract', () => {
        const result = buildAgentToolEnvironment('planner', {
            entrypoint: { args: [], executable: '/opt/grotto' },
            serverUrl: 'http://127.0.0.1:18790',
        });
        expect(result.env.GROTTO_AGENT_ID).toBe('planner');
        expect(fs.statSync(result.tokenFile).mode & 0o777).toBe(0o600);
    });

    test('refreshes wrapper content idempotently', () => {
        const first = buildAgentToolEnvironment('agt_wren', {
            entrypoint: { args: [], executable: '/opt/grotto-v1' },
            serverUrl: 'http://127.0.0.1:1001',
        });
        buildAgentToolEnvironment('agt_wren', {
            entrypoint: { args: [], executable: '/opt/grotto-v2' },
            serverUrl: 'http://127.0.0.1:1002',
        });
        const content = fs.readFileSync(first.wrapperPath, 'utf8');
        expect(content).toContain("GROTTO_SERVER_URL='http://127.0.0.1:1002'");
        expect(content).toContain('exec \'/opt/grotto-v2\' "$@"');
        expect(content).not.toContain('grotto-v1');
    });

    test('uses the Runtime bound URL in the tool environment', () => {
        setAgentCliServerUrl(new URL('http://127.0.0.1:43123'));
        const result = buildAgentToolEnvironment('agt_wren', {
            entrypoint: { args: [], executable: '/opt/grotto' },
        });
        expect(result.env.GROTTO_SERVER_URL).toBe('http://127.0.0.1:43123');
        expect(fs.readFileSync(result.wrapperPath, 'utf8')).toContain(
            "GROTTO_SERVER_URL='http://127.0.0.1:43123'"
        );
    });

    test('resolves dev and packaged entrypoints', () => {
        expect(resolveAgentCliEntrypoint('/usr/bin/bun', ['/usr/bin/bun', 'src/index.ts'])).toEqual(
            {
                args: [path.resolve('src/index.ts')],
                executable: '/usr/bin/bun',
            }
        );
        expect(resolveAgentCliEntrypoint('/opt/grotto', ['/opt/grotto', 'serve'])).toEqual({
            args: [],
            executable: '/opt/grotto',
        });
    });
});
