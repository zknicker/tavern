import { describe, expect, it } from 'bun:test';
import { getDesktopOAuthReloadOptions } from './desktop-oauth-callback.ts';

describe('getDesktopOAuthReloadOptions', () => {
    it('reads the Clerk rotating token nonce from a desktop callback', () => {
        expect(
            getDesktopOAuthReloadOptions(
                'grotto://sso-callback?created_session_id=sess_123&rotating_token_nonce=nonce_456'
            )
        ).toEqual({ rotatingTokenNonce: 'nonce_456' });
    });

    it('reloads the client-bound attempt when Clerk returns an empty callback', () => {
        expect(getDesktopOAuthReloadOptions('grotto://sso-callback')).toEqual({});
    });
});
