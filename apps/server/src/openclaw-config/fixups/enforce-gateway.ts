import crypto from 'node:crypto';
import type { OpenClawConfigFixup } from './types.ts';

export const enforceGatewayFixup: OpenClawConfigFixup = {
    apply: async ({ config }) => {
        const fixedConfig = enforceGatewayConfig(config);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated OpenClaw gateway settings for Tavern Runtime.' : null,
        };
    },
    id: 'enforce-gateway',
    label: 'Enforce gateway settings',
};

function enforceGatewayConfig(config: Record<string, unknown>) {
    const gateway = readRecord(config.gateway);
    const auth = readRecord(gateway.auth);

    return {
        ...config,
        gateway: {
            ...gateway,
            auth: {
                ...auth,
                mode: 'token',
                token: auth.token ?? createGatewayToken(),
            },
            bind: 'loopback',
            mode: 'local',
            port: resolveGatewayPort(),
        },
    };
}

function resolveGatewayPort() {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL?.trim();
    if (!gatewayUrl) {
        return 18_789;
    }

    try {
        const parsed = new URL(gatewayUrl);
        const port = Number.parseInt(parsed.port, 10);
        return Number.isInteger(port) && port > 0 ? port : 18_789;
    } catch {
        return 18_789;
    }
}

function createGatewayToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function toStableJson(value: unknown) {
    return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortJson);
    }

    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, sortJson(nested)])
        );
    }

    return value;
}
