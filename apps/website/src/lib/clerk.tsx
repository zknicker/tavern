import { ClerkProvider } from '@clerk/react';
import type { ReactNode } from 'react';

const clerkPublishableKey: string | null = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || null;

// Sign-in is optional in local dev and e2e: without a key the app runs signed-out.
export const isClerkEnabled = clerkPublishableKey !== null;

interface ClerkGlobal {
    session?: { getToken(): Promise<string | null> } | null;
}

/**
 * Current Clerk session token for API auth headers. clerk-js refreshes the
 * short-lived JWT internally; read it fresh per request, never cache it.
 */
export async function getClerkSessionToken(): Promise<string | null> {
    if (!isClerkEnabled) {
        return null;
    }
    const clerk = (window as { Clerk?: ClerkGlobal }).Clerk;
    try {
        return (await clerk?.session?.getToken()) ?? null;
    } catch {
        return null;
    }
}

export function TavernClerkProvider({ children }: { children: ReactNode }) {
    if (!clerkPublishableKey) {
        return children;
    }
    return (
        <ClerkProvider afterSignOutUrl="/" publishableKey={clerkPublishableKey}>
            {children}
        </ClerkProvider>
    );
}
