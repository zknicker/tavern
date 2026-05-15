import type { OpenClawGatewayAuth, OpenClawGatewayDevice, OpenClawOperatorScope } from './types.ts';

export const defaultOpenClawOperatorScopes = [
    'operator.admin',
    'operator.read',
    'operator.write',
] as const satisfies OpenClawOperatorScope[];

export interface BuildConnectParamsInput {
    auth?: OpenClawGatewayAuth;
    challengeNonce?: string | null;
    clientId: string;
    clientMode: string;
    clientVersion: string;
    device?: OpenClawGatewayDevice;
    scopes: OpenClawOperatorScope[];
    userAgent: string;
}

const openClawGatewayProtocolVersion = 4;

export async function buildConnectParams(input: BuildConnectParamsInput) {
    const signedAt = Date.now();
    const nonce = input.challengeNonce ?? null;
    const role = 'operator';
    const version = nonce ? 'v2' : 'v1';

    return {
        auth: input.auth ?? {},
        caps: [],
        client: {
            id: input.clientId,
            mode: input.clientMode,
            platform: 'tavern',
            version: input.clientVersion,
        },
        commands: [],
        device:
            input.device && nonce
                ? {
                      id: input.device.id,
                      nonce,
                      publicKey: input.device.publicKey,
                      signature: await input.device.signChallenge({
                          authToken: input.auth?.token,
                          clientId: input.clientId,
                          clientMode: input.clientMode,
                          nonce,
                          role,
                          scopes: input.scopes,
                          signedAt,
                          version,
                      }),
                      signedAt,
                  }
                : undefined,
        locale: 'en-US',
        maxProtocol: openClawGatewayProtocolVersion,
        minProtocol: openClawGatewayProtocolVersion,
        permissions: {},
        role,
        scopes: input.scopes,
        userAgent: input.userAgent,
    };
}
