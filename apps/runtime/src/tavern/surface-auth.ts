import { createHash, timingSafeEqual } from 'node:crypto';
import type { RuntimeRequestAuth } from '../identity/auth.ts';
import { resolveAgentToken } from './agent-tokens.ts';

export type ClerkAuthResolver = (token: string) => Promise<RuntimeRequestAuth | null>;

export async function resolveRuntimeRequestAuth(
    authorizationHeader: string | undefined,
    expectedToken: string,
    resolveClerkAuth: ClerkAuthResolver
): Promise<RuntimeRequestAuth | null> {
    if (isBearerTokenValid(authorizationHeader, expectedToken)) {
        return { kind: 'runtime-token' };
    }
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return null;
    }
    const bearerToken = authorizationHeader.slice(7);
    const agentId = resolveAgentToken(bearerToken);
    if (agentId) {
        return { agentId, kind: 'agent-token' };
    }
    return await resolveClerkAuth(bearerToken);
}

export function isPrincipalAllowedOnSurface(auth: RuntimeRequestAuth, pathname: string): boolean {
    return auth.kind === 'agent-token'
        ? pathname.startsWith('/api/agent/')
        : !pathname.startsWith('/api/agent/');
}

function isBearerTokenValid(
    authorizationHeader: string | undefined,
    expectedToken: string
): boolean {
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return false;
    }
    try {
        const providedHash = createHash('sha256').update(authorizationHeader.slice(7)).digest();
        const expectedHash = createHash('sha256').update(expectedToken).digest();
        return timingSafeEqual(providedHash, expectedHash);
    } catch {
        return false;
    }
}
