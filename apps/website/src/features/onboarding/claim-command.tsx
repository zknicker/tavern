import { useUser } from '@clerk/react';
import * as React from 'react';
import { Button } from '../../components/ui/primitives/button.tsx';
import { clerkPublishableKey, isClerkEnabled } from '../../lib/clerk.tsx';

/**
 * The host-side command that binds a runtime to the signed-in account
 * (`tavern claim`). Rendered on the connect-runtime page so new runtimes are
 * claimed explicitly instead of racing on first connect.
 */
export function ClaimCommand() {
    // Keyless dev mode has no ClerkProvider, so the useUser call below must
    // stay behind this gate.
    if (!(isClerkEnabled && clerkPublishableKey)) {
        return null;
    }
    return <SignedInClaimCommand />;
}

function SignedInClaimCommand() {
    const command = useClaimCommand();
    const [copied, setCopied] = React.useState(false);
    if (!command) {
        return null;
    }
    return (
        <div className="grid gap-1.5">
            <p className="text-muted-foreground text-sm">
                New runtime? Run this on the runtime host to link it to your account:
            </p>
            <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 select-text overflow-x-auto whitespace-nowrap rounded-md border border-border bg-muted px-3 py-2 font-mono text-foreground text-xs">
                    {command}
                </code>
                <Button
                    onClick={async () => {
                        await navigator.clipboard.writeText(command);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
        </div>
    );
}

function useClaimCommand(): string | null {
    const { user } = useUser();
    if (!(isClerkEnabled && clerkPublishableKey && user)) {
        return null;
    }
    return `tavern claim --clerk-key ${clerkPublishableKey} --user ${user.id}`;
}
