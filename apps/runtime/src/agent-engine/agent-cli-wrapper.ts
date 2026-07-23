import fs from 'node:fs';
import path from 'node:path';
import { getRuntimeHost, getRuntimePort, getRuntimeRoot } from '../config.ts';
import {
    agentTokenPath,
    deleteAgentToken,
    mintAgentToken,
    readAgentToken,
} from '../tavern/agent-tokens.ts';

export interface AgentCliEntrypoint {
    args: string[];
    executable: string;
}

export interface AgentToolEnvironment {
    binDir: string;
    env: Record<string, string>;
    tokenFile: string;
    wrapperPath: string;
}

let boundServerUrl: string | null = null;

export function setAgentCliServerUrl(url: URL | null): void {
    boundServerUrl = url ? url.toString().replace(/\/$/u, '') : null;
}

export function buildAgentToolEnvironment(
    agentId: string,
    options: {
        entrypoint?: AgentCliEntrypoint;
        inheritedPath?: string;
        serverUrl?: string;
    } = {}
): AgentToolEnvironment {
    const runtimeRoot = getRuntimeRoot();
    const binDir = path.join(runtimeRoot, 'agent-bin', agentId);
    const tokenFile = ensureAgentToken(agentId);
    const serverUrl = options.serverUrl ?? configuredRuntimeUrl();
    const wrapperPath = path.join(binDir, 'grotto');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
        wrapperPath,
        wrapperScript({
            agentId,
            binDir,
            entrypoint: options.entrypoint ?? resolveAgentCliEntrypoint(),
            serverUrl,
            tokenFile,
        }),
        { mode: 0o755 }
    );
    fs.chmodSync(wrapperPath, 0o755);
    return {
        binDir,
        env: {
            GROTTO_AGENT_ID: agentId,
            GROTTO_AGENT_TOKEN_FILE: tokenFile,
            GROTTO_SERVER_URL: serverUrl,
            PATH: `${binDir}${path.delimiter}${options.inheritedPath ?? process.env.PATH ?? ''}`,
        },
        tokenFile,
        wrapperPath,
    };
}

export function removeAgentToolEnvironment(agentId: string): void {
    deleteAgentToken(agentId);
    fs.rmSync(path.join(getRuntimeRoot(), 'agent-bin', agentId), { force: true, recursive: true });
}

export function resolveAgentCliEntrypoint(
    execPath = process.execPath,
    argv = process.argv
): AgentCliEntrypoint {
    const script = argv[1];
    if (script && /\.(?:c?js|mjs|ts)$/u.test(script)) {
        return { args: [path.resolve(script)], executable: execPath };
    }
    return { args: [], executable: execPath };
}

function ensureAgentToken(agentId: string): string {
    if (!readAgentToken(agentId)) {
        mintAgentToken(agentId);
    }
    return agentTokenPath(agentId);
}

function configuredRuntimeUrl(): string {
    if (boundServerUrl) {
        return boundServerUrl;
    }
    const host = normalizeHostForUrl(getRuntimeHost());
    return `http://${host}:${getRuntimePort()}`;
}

function normalizeHostForUrl(host: string): string {
    if (host === '::' || host === '0.0.0.0') {
        return '127.0.0.1';
    }
    return host.includes(':') ? `[${host}]` : host;
}

function wrapperScript(input: {
    agentId: string;
    binDir: string;
    entrypoint: AgentCliEntrypoint;
    serverUrl: string;
    tokenFile: string;
}): string {
    const command = [input.entrypoint.executable, ...input.entrypoint.args]
        .map(shellQuote)
        .join(' ');
    const compositionIdFile = shellQuote(path.join(input.binDir, 'composition-id'));
    return [
        '#!/bin/sh',
        `export GROTTO_AGENT_ID=${shellQuote(input.agentId)}`,
        `export GROTTO_SERVER_URL=${shellQuote(input.serverUrl)}`,
        `export GROTTO_AGENT_TOKEN_FILE=${shellQuote(input.tokenFile)}`,
        // The harness observer parks a composition id per in-flight send
        // (I1); the wrapper forwards it so the CLI can tag the send.
        `if [ -f ${compositionIdFile} ]; then`,
        `  GROTTO_COMPOSITION_ID=$(cat ${compositionIdFile} 2>/dev/null)`,
        '  export GROTTO_COMPOSITION_ID',
        'fi',
        `exec ${command} "$@"`,
        '',
    ].join('\n');
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}
