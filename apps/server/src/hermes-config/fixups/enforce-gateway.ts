import crypto from 'node:crypto';
import type { HermesConfigFixup } from './types.ts';

export const enforceGatewayFixup: HermesConfigFixup = {
    apply: async ({ config }) => {
        const fixedConfig = enforceGatewayConfig(config);
        const changed = toStableJson(config) !== toStableJson(fixedConfig);

        return {
            changed,
            config: fixedConfig,
            message: changed ? 'Updated Hermes gateway settings for Tavern Runtime.' : null,
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
    const port = Number.parseInt(process.env.TAVERN_HERMES_PORT ?? '9119', 10);
    if (Number.isInteger(port) && port > 0) {
        return port;
    }
    return 9119;
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
