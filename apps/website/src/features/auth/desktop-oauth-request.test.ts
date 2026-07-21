import { describe, expect, it } from 'bun:test';
import { desktopGoogleOAuthRequest } from './desktop-oauth-request.ts';

describe('desktopGoogleOAuthRequest', () => {
    it('uses the Grotto native callback without forcing a browser account chooser', () => {
        expect(desktopGoogleOAuthRequest).toEqual({
            redirectUrl: 'grotto://sso-callback',
            strategy: 'oauth_google',
        });
    });
});
