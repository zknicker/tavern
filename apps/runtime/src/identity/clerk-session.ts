import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { getClerkPublishableKey } from '../config.ts';

/**
 * Verifies Clerk session JWTs against the instance JWKS. The instance is
 * identified by the publishable key (env `TAVERN_CLERK_PUBLISHABLE_KEY` or
 * `clerkPublishableKey` in tavern.json); without one, Clerk auth is disabled
 * and only the runtime token authenticates.
 */

export interface VerifiedClerkSession {
    clerkUserId: string;
}

export interface ClerkVerifier {
    verify(token: string): Promise<VerifiedClerkSession>;
}

// Publishable keys encode the frontend API origin: pk_test_<base64("host$")>.
export function clerkFrontendOrigin(publishableKey: string): string | null {
    const match = /^pk_(?:test|live)_(?<encoded>[A-Za-z0-9+/=]+)$/.exec(publishableKey.trim());
    if (!match?.groups) {
        return null;
    }
    let decoded: string;
    try {
        decoded = Buffer.from(match.groups.encoded, 'base64').toString('utf8');
    } catch {
        return null;
    }
    if (!decoded.endsWith('$')) {
        return null;
    }
    const host = decoded.slice(0, -1);
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
}

export function createClerkVerifier(issuer: string, getKey: JWTVerifyGetKey): ClerkVerifier {
    return {
        async verify(token: string): Promise<VerifiedClerkSession> {
            const { payload } = await jwtVerify(token, getKey, {
                clockTolerance: 10,
                issuer,
            });
            if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
                throw new Error('Clerk session token has no subject.');
            }
            return { clerkUserId: payload.sub };
        },
    };
}

let cachedVerifier: { key: string; verifier: ClerkVerifier } | null = null;

/** Returns null when no Clerk publishable key is configured. */
export function getConfiguredClerkVerifier(): ClerkVerifier | null {
    const publishableKey = getClerkPublishableKey();
    if (!publishableKey) {
        return null;
    }
    if (cachedVerifier?.key === publishableKey) {
        return cachedVerifier.verifier;
    }
    const origin = clerkFrontendOrigin(publishableKey);
    if (!origin) {
        return null;
    }
    const getKey = createRemoteJWKSet(new URL(`${origin}/.well-known/jwks.json`));
    cachedVerifier = { key: publishableKey, verifier: createClerkVerifier(origin, getKey) };
    return cachedVerifier.verifier;
}

export function isClerkConfigured(): boolean {
    const publishableKey = getClerkPublishableKey();
    return publishableKey !== null && clerkFrontendOrigin(publishableKey) !== null;
}
