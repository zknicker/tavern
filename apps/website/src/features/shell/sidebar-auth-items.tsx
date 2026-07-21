import { SignedIn, SignedOut, useClerk, useUser } from '@clerk/clerk-react';
import { Logout01Icon, UserCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { useDesktopOAuth } from '../auth/use-desktop-oauth.ts';

/**
 * Custom account row — no prebuilt Clerk UI components here: the Electron
 * surface runs headless native clerk-js, which has none, and the web surface
 * stays consistent with it.
 */
export function SidebarAuthItems() {
    if (!isClerkEnabled) {
        return null;
    }
    return (
        <>
            <SignedOut>
                <SidebarMenuItem>
                    <SignInMenuButton />
                </SidebarMenuItem>
            </SignedOut>
            <SignedIn>
                <SidebarMenuItem>
                    <SignedInRow />
                </SidebarMenuItem>
            </SignedIn>
        </>
    );
}

function SignInMenuButton() {
    const clerk = useClerk();
    const { startGoogleSignIn } = useDesktopOAuth();
    const onClick = () => {
        if (isElectronDesktopApp()) {
            startGoogleSignIn().catch(() => {
                // The sign-in gate is the primary surface; failures surface there.
            });
            return;
        }
        void clerk.openSignIn({});
    };
    return (
        <SidebarMenuButton onClick={onClick}>
            <Icon aria-hidden="true" className="shrink-0" icon={UserCircleIcon} size={18} />
            <span>Sign in</span>
        </SidebarMenuButton>
    );
}

function SignedInRow() {
    const clerk = useClerk();
    const { user } = useUser();
    const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account';
    const signOut = () => {
        if (isElectronDesktopApp()) {
            void clerk.signOut(() => undefined);
            return;
        }
        void clerk.signOut();
    };
    return (
        <div className="flex h-8 items-center gap-2 px-2">
            {user?.imageUrl ? (
                <img
                    alt=""
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded-full"
                    height={20}
                    src={user.imageUrl}
                    width={20}
                />
            ) : (
                <Icon aria-hidden="true" className="shrink-0" icon={UserCircleIcon} size={18} />
            )}
            <span className="min-w-0 flex-1 truncate text-sidebar-foreground text-sm">
                {displayName}
            </span>
            <button
                aria-label="Sign out"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={signOut}
                type="button"
            >
                <Icon aria-hidden="true" icon={Logout01Icon} size={16} />
            </button>
        </div>
    );
}
