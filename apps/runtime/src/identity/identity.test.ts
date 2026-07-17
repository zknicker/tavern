import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { claimRuntimeForClerkUser } from './claim';
import { clerkFrontendOrigin, createClerkVerifier } from './clerk-session';
import { createInvite, listInvites, redeemInvite } from './invites';
import {
    addMember,
    claimOwnershipIfUnclaimed,
    getMemberRole,
    getOwner,
    listMembers,
    removeMember,
} from './members';
import { getOrCreateUserByClerkId } from './users';

describe('identity users and members', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('mints one stable tavern user per clerk id', () => {
        const first = getOrCreateUserByClerkId('user_clerk_a');
        const again = getOrCreateUserByClerkId('user_clerk_a');
        const other = getOrCreateUserByClerkId('user_clerk_b');

        expect(first.id).toMatch(/^usr_/);
        expect(again.id).toBe(first.id);
        expect(other.id).not.toBe(first.id);
    });

    it('first claim wins ownership; later claims are no-ops', () => {
        const alice = getOrCreateUserByClerkId('user_alice');
        const bob = getOrCreateUserByClerkId('user_bob');

        claimOwnershipIfUnclaimed(alice.id);
        claimOwnershipIfUnclaimed(bob.id);

        expect(getMemberRole(alice.id)).toBe('owner');
        expect(getMemberRole(bob.id)).toBeNull();
        expect(getOwner()?.user.id).toBe(alice.id);
    });

    it('owner cannot be removed; members can', () => {
        const alice = getOrCreateUserByClerkId('user_alice');
        const bob = getOrCreateUserByClerkId('user_bob');
        claimOwnershipIfUnclaimed(alice.id);
        addMember(bob.id, 'member');

        expect(() => removeMember(alice.id)).toThrow();
        removeMember(bob.id);
        expect(getMemberRole(bob.id)).toBeNull();
        expect(listMembers()).toHaveLength(1);
    });
});

describe('identity invites', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('redeems a single-use invite into membership', () => {
        const owner = getOrCreateUserByClerkId('user_owner');
        claimOwnershipIfUnclaimed(owner.id);
        const invite = createInvite(owner.id);
        const joiner = getOrCreateUserByClerkId('user_joiner');

        expect(redeemInvite(invite.code, joiner.id)).toEqual({ ok: true });
        expect(getMemberRole(joiner.id)).toBe('member');

        const second = getOrCreateUserByClerkId('user_second');
        expect(redeemInvite(invite.code, second.id)).toEqual({
            ok: false,
            reason: 'already-redeemed',
        });
        expect(redeemInvite('bogus', second.id)).toEqual({ ok: false, reason: 'invalid' });
        expect(redeemInvite(invite.code, joiner.id)).toEqual({
            ok: false,
            reason: 'already-member',
        });
        expect(listInvites()[0]?.redeemedBy).toBe(joiner.id);
    });
});

describe('runtime claim', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    const validKey = `pk_test_${Buffer.from('foo.clerk.accounts.dev$').toString('base64')}`;

    it('claims for one clerk user, idempotently, and refuses others', () => {
        expect(claimRuntimeForClerkUser({ clerkUserId: 'user_a', publishableKey: 'junk' })).toEqual(
            { ok: false, reason: 'invalid-key' }
        );

        const first = claimRuntimeForClerkUser({
            clerkUserId: 'user_a',
            publishableKey: validKey,
        });
        expect(first).toMatchObject({ alreadyOwner: false, ok: true });

        const again = claimRuntimeForClerkUser({
            clerkUserId: 'user_a',
            publishableKey: validKey,
        });
        expect(again).toMatchObject({ alreadyOwner: true, ok: true });

        expect(
            claimRuntimeForClerkUser({ clerkUserId: 'user_b', publishableKey: validKey })
        ).toEqual({ ok: false, reason: 'claimed-by-other' });
    });
});

describe('clerk session verification', () => {
    it('derives the frontend origin from a publishable key', () => {
        const encoded = Buffer.from('winning-mole-12.clerk.accounts.dev$').toString('base64');
        expect(clerkFrontendOrigin(`pk_test_${encoded}`)).toBe(
            'https://winning-mole-12.clerk.accounts.dev'
        );
        expect(clerkFrontendOrigin('pk_test_not-base64!')).toBeNull();
        expect(clerkFrontendOrigin('sk_test_abc')).toBeNull();
    });

    it('verifies a session token and rejects bad issuer or signature', async () => {
        const issuer = 'https://example.clerk.accounts.dev';
        const { privateKey, publicKey } = await generateKeyPair('RS256');
        const jwk = await exportJWK(publicKey);
        const verifier = createClerkVerifier(issuer, async () => publicKey);

        const token = await new SignJWT({})
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer(issuer)
            .setSubject('user_123')
            .setIssuedAt()
            .setExpirationTime('2m')
            .sign(privateKey);
        await expect(verifier.verify(token)).resolves.toEqual({ clerkUserId: 'user_123' });

        const wrongIssuer = await new SignJWT({})
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer('https://evil.example.com')
            .setSubject('user_123')
            .setIssuedAt()
            .setExpirationTime('2m')
            .sign(privateKey);
        await expect(verifier.verify(wrongIssuer)).rejects.toThrow();

        const { privateKey: otherKey } = await generateKeyPair('RS256');
        const forged = await new SignJWT({})
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer(issuer)
            .setSubject('user_123')
            .setIssuedAt()
            .setExpirationTime('2m')
            .sign(otherKey);
        await expect(verifier.verify(forged)).rejects.toThrow();
        expect(jwk.kty).toBe('RSA');
    });
});
