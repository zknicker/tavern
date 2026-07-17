import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import { UserAdd01Icon, UserCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { SidebarMenuButton, SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';

export function SidebarAuthItems() {
    if (!isClerkEnabled) {
        return null;
    }
    return (
        <>
            <Show when="signed-out">
                <SidebarMenuItem>
                    <SignInButton mode="modal">
                        <SidebarMenuButton>
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={UserCircleIcon}
                                size={18}
                            />
                            <span>Sign in</span>
                        </SidebarMenuButton>
                    </SignInButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SignUpButton mode="modal">
                        <SidebarMenuButton>
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={UserAdd01Icon}
                                size={18}
                            />
                            <span>Create account</span>
                        </SidebarMenuButton>
                    </SignUpButton>
                </SidebarMenuItem>
            </Show>
            <Show when="signed-in">
                <SidebarMenuItem>
                    <SignedInRow />
                </SidebarMenuItem>
            </Show>
        </>
    );
}

function SignedInRow() {
    const { user } = useUser();
    const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account';
    return (
        <div className="flex h-8 items-center gap-2 px-2">
            <UserButton />
            <span className="truncate text-sidebar-foreground text-sm">{displayName}</span>
        </div>
    );
}
