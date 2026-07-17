import { ClerkFailed, ClerkLoaded, ClerkLoading, Show, SignInButton } from '@clerk/react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/button.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';

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
    return (
        <>
            <ClerkLoading>
                <GateFrame />
            </ClerkLoading>
            <ClerkFailed>{children}</ClerkFailed>
            <ClerkLoaded>
                <Show fallback={<GateFrame signIn />} when="signed-in">
                    {children}
                </Show>
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
            {signIn ? (
                <SignInButton mode="modal">
                    <Button>Sign in</Button>
                </SignInButton>
            ) : null}
        </div>
    );
}
