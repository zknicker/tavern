import { describe, expect, it } from 'bun:test';
import { parseRotatingTokenNonce } from './desktop-oauth-callback.ts';

describe('parseRotatingTokenNonce', () => {
    it('reads the Clerk rotating token nonce from a desktop callback', () => {
        expect(
            parseRotatingTokenNonce(
                'tavern://sso-callback?created_session_id=sess_123&rotating_token_nonce=nonce_456'
            )
        ).toBe('nonce_456');
    });

    it('rejects callbacks without a rotating token nonce', () => {
        expect(() => parseRotatingTokenNonce('tavern://sso-callback')).toThrow(
            'did not include a rotating token nonce'
        );
    });
});
