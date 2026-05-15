'use client';

import { Button } from '../../components/ui/primitives/button.tsx';
import { useSessionResync } from '../../hooks/sessions/use-session-resync.ts';

export function SessionResyncButton({ sessionKey }: { sessionKey: string }) {
    const resyncSession = useSessionResync();

    return (
        <Button
            loading={resyncSession.isPending}
            onClick={() => resyncSession.mutate({ sessionKey })}
            size="xs"
            variant="secondary"
        >
            Resync
        </Button>
    );
}
