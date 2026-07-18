import {
    ClerkFailed,
    ClerkLoaded,
    ClerkLoading,
    SignedIn,
    SignedOut,
    SignInButton,
} from '@clerk/clerk-react';
import { type ReactNode, useState } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { useDesktopOAuth } from './use-desktop-oauth.ts';

/**
 * Mandatory sign-in (specs/identity.md): with Clerk configured, the app
 * renders only for a signed-in user. Grace paths keep the app sync-first:
 * keyless dev builds skip the gate entirely, and if clerk-js cannot load
 * (offline) we render the app on the cached identity rather than lock the
 * user out of local data.
 */
export function SignInGate({ children }: { children: ReactNode }) {
    if (!isClerkEnabled) {
        return children;
    }

    if (window.location.pathname === '/sso-callback') {
        return children;
    }

    return (
        <>
            <ClerkLoading>
                <GateFrame />
            </ClerkLoading>
            <ClerkFailed>{children}</ClerkFailed>
            {/* ClerkLoaded also covers the degraded status (degraded implies
                loaded), so SignedIn/SignedOut decide there too — a degraded
                client with a cached session stays signed in (offline grace),
                and a degraded signed-out client sees the gate. A separate
                ClerkDegraded branch would double-mount alongside this one. */}
            <ClerkLoaded>
                <SignedIn>{children}</SignedIn>
                <SignedOut>
                    <GateFrame signIn />
                </SignedOut>
            </ClerkLoaded>
        </>
    );
}

function GateFrame({ signIn = false }: { signIn?: boolean }) {
    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-semibold text-2xl text-foreground">Welcome to Tavern</h1>
                <p className="max-w-sm text-muted-foreground text-sm">
                    Sign in to open your Tavern.
                </p>
            </div>
            {signIn ? <SignInAction /> : null}
        </div>
    );
}

function SignInAction() {
    if (isElectronDesktopApp()) {
        return <DesktopGoogleSignIn />;
    }

    return (
        <SignInButton mode="modal">
            <Button>Sign in</Button>
        </SignInButton>
    );
}

function DesktopGoogleSignIn() {
    const { startGoogleSignIn } = useDesktopOAuth();
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const handleSignIn = async () => {
        setError(null);
        setIsStarting(true);

        try {
            await startGoogleSignIn();
        } catch (signInError) {
            setError(getErrorMessage(signInError));
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <Button disabled={isStarting} onClick={handleSignIn}>
                {isStarting ? 'Opening Google…' : 'Continue with Google'}
            </Button>
            {error ? (
                <p className="max-w-sm text-center text-destructive text-sm">{error}</p>
            ) : null}
        </div>
    );
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Google sign-in failed. Please try again.';
}
