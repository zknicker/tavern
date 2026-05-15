import { describe, expect, test } from 'bun:test';
import { enforceGatewayFixup } from './enforce-gateway.ts';

describe('enforceGatewayFixup', () => {
    test('sets OpenClaw gateway to token-authenticated loopback mode', async () => {
        const result = await enforceGatewayFixup.apply({
            config: {
                gateway: {
                    auth: {
                        token: 'existing-token',
                    },
                    bind: 'tailnet',
                    port: 1234,
                },
            },
            context: {
                runtimeId: 'tavern-openclaw-managed',
            },
        });

        expect(result.changed).toBe(true);
        expect(result.config.gateway).toMatchObject({
            auth: {
                mode: 'token',
                token: 'existing-token',
            },
            bind: 'loopback',
            mode: 'local',
            port: 18_789,
        });
    });

    test('generates a token when gateway auth is missing', async () => {
        const result = await enforceGatewayFixup.apply({
            config: {},
            context: {
                runtimeId: 'tavern-openclaw-managed',
            },
        });
        const gateway = result.config.gateway as Record<string, unknown>;
        const auth = gateway.auth as Record<string, unknown>;

        expect(result.changed).toBe(true);
        expect(auth.mode).toBe('token');
        expect(typeof auth.token).toBe('string');
        expect((auth.token as string).length).toBeGreaterThan(20);
    });
});
