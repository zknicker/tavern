import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createOpenClawAgentRuntimeClient } from '@tavern/openclaw-gateway-adapter';
import { readConfigValue } from '../config';

const defaultGatewayUrl = 'ws://127.0.0.1:18789';

export function createLocalOpenClawClient() {
    return createOpenClawAgentRuntimeClient(createLocalOpenClawGatewayOptions());
}

export function createLocalOpenClawGatewayOptions() {
    const token = readOpenClawGatewayToken();

    return {
        ...(token ? { auth: { token } } : {}),
        clientId: 'gateway-client',
        clientMode: 'backend',
        gatewayUrl: readOpenClawGatewayUrl(),
    };
}

function readOpenClawGatewayUrl() {
    return readConfigValue('OPENCLAW_GATEWAY_URL') || defaultGatewayUrl;
}

function readOpenClawGatewayToken() {
    const envToken = readConfigValue('OPENCLAW_GATEWAY_TOKEN');
    if (envToken) {
        return envToken;
    }

    const config = readOpenClawConfig();
    const token = readString(readRecord(readRecord(config.gateway).auth).token);
    return token?.trim() || null;
}

function readOpenClawConfig() {
    const configPath = path.join(resolveOpenClawConfigDir(), 'openclaw.json');

    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function resolveOpenClawConfigDir() {
    const configPath = readConfigValue('OPENCLAW_CONFIG_PATH');
    if (configPath) {
        return path.dirname(resolveHomePath(configPath));
    }

    const configured = readConfigValue('OPENCLAW_CONFIG_DIR');
    if (!configured) {
        return path.join(os.homedir(), '.openclaw');
    }
    return resolveHomePath(configured);
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : null;
}

function resolveHomePath(value: string) {
    if (value === '~') {
        return os.homedir();
    }
    if (value.startsWith('~/')) {
        return path.join(os.homedir(), value.slice(2));
    }
    return path.resolve(value);
}
