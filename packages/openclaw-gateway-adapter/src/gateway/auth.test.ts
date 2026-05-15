import { describe, expect, test } from 'bun:test';
import { buildConnectParams, defaultOpenClawOperatorScopes } from './auth.ts';
import type { OpenClawGatewayDeviceSignerInput } from './types.ts';

describe('OpenClaw Gateway auth', () => {
    test('includes signed device identity with the challenge nonce', async () => {
        const signer: { input: OpenClawGatewayDeviceSignerInput | null } = { input: null };

        const params = await buildConnectParams({
            auth: { token: 'gateway-token' },
            challengeNonce: 'challenge-nonce',
            clientId: 'gateway-client',
            clientMode: 'backend',
            clientVersion: '0.1.0',
            device: {
                id: 'device-id',
                publicKey: 'public-key',
                signChallenge(input) {
                    signer.input = input;
                    return 'signature';
                },
            },
            scopes: [...defaultOpenClawOperatorScopes],
            userAgent: 'tavern/test',
        });

        expect(params.device).toEqual({
            id: 'device-id',
            nonce: 'challenge-nonce',
            publicKey: 'public-key',
            signature: 'signature',
            signedAt: expect.any(Number),
        });
        expect(params.minProtocol).toBe(4);
        expect(params.maxProtocol).toBe(4);
        const signerInput = signer.input;

        if (!signerInput) {
            throw new Error('Expected device signer to be called.');
        }

        expect(signerInput).toEqual({
            authToken: 'gateway-token',
            clientId: 'gateway-client',
            clientMode: 'backend',
            nonce: 'challenge-nonce',
            role: 'operator',
            scopes: ['operator.admin', 'operator.read', 'operator.write'],
            signedAt: expect.any(Number),
            version: 'v2',
        });
    });
});
