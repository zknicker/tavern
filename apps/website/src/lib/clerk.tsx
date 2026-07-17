import { ClerkProvider } from '@clerk/react';
import type { ReactNode } from 'react';

const clerkPublishableKey: string | null = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || null;

// Sign-in is optional in local dev and e2e: without a key the app runs signed-out.
export const isClerkEnabled = clerkPublishableKey !== null;

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
