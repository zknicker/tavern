import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { trpc } from '../../lib/trpc.tsx';

const keepaliveIntervalMs = 60_000;

export function SessionTokenKeepalive() {
    if (!isClerkEnabled) {
        return null;
    }

    return <SessionTokenKeepaliveInner />;
}

function SessionTokenKeepaliveInner() {
    const { isSignedIn } = useAuth();
    const { mutate: pushSessionToken } = trpc.identity.pushSessionToken.useMutation();

    useEffect(() => {
        if (!isSignedIn) {
            return;
        }

        pushSessionToken();
        const interval = window.setInterval(pushSessionToken, keepaliveIntervalMs);
        return () => window.clearInterval(interval);
    }, [isSignedIn, pushSessionToken]);

    return null;
}
