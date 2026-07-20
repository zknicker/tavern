import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useCallback, useEffect, useRef } from 'react';
import { getDesktopBridge, isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { parseRotatingTokenNonce } from './desktop-oauth-callback.ts';

export function useDesktopOAuth() {
    const { isLoaded: isSignInLoaded, setActive, signIn } = useSignIn();
    const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
    const unsubscribeRef = useRef<null | (() => void)>(null);

    useEffect(() => () => unsubscribeRef.current?.(), []);

    const startGoogleSignIn = useCallback(async () => {
        if (!(isSignInLoaded && isSignUpLoaded)) {
            throw new Error('Sign in is still loading.');
        }

        if (!isElectronDesktopApp()) {
            await signIn.authenticateWithRedirect({
                redirectUrl: `${window.location.origin}/sso-callback`,
                redirectUrlComplete: '/',
                strategy: 'oauth_google',
            });
            return;
        }

        const bridge = getDesktopBridge();
        if (!bridge) {
            throw new Error('The Grotto desktop bridge is unavailable.');
        }

        await signIn.create({
            redirectUrl: 'grotto://sso-callback',
            strategy: 'oauth_google',
        });

        const redirectUrl = signIn.firstFactorVerification.externalVerificationRedirectURL;
        if (!redirectUrl) {
            throw new Error('Google sign-in did not return an authorization URL.');
        }
        redirectUrl.searchParams.set('prompt', 'select_account');

        unsubscribeRef.current?.();
        await bridge.openExternal(redirectUrl.toString());

        await new Promise<void>((resolve, reject) => {
            let handlingCallback = false;
            const unsubscribe = bridge.onSsoCallback(async (callbackUrl) => {
                if (handlingCallback) {
                    return;
                }
                handlingCallback = true;

                try {
                    const rotatingTokenNonce = parseRotatingTokenNonce(callbackUrl);
                    await signIn.reload({ rotatingTokenNonce });

                    let createdSessionId: string | null = null;
                    if (signIn.status === 'complete') {
                        createdSessionId = signIn.createdSessionId;
                    } else if (signIn.firstFactorVerification.status === 'transferable') {
                        await signUp.create({ transfer: true });
                        createdSessionId = signUp.createdSessionId;
                    }

                    if (!createdSessionId) {
                        throw new Error(
                            'Google sign-in requires an unsupported verification step.'
                        );
                    }

                    await setActive({ session: createdSessionId });
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    unsubscribe();
                    unsubscribeRef.current = null;
                }
            });
            unsubscribeRef.current = unsubscribe;
        });
    }, [isSignInLoaded, isSignUpLoaded, setActive, signIn, signUp]);

    return { startGoogleSignIn };
}
