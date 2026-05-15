import { ArrowLeft02Icon, ArrowRight02Icon } from '@hugeicons-pro/core-solid-rounded';
import { AppShellTopbar, AppShellTopbarSidebarSlot } from '../../components/ui/app-shell.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SidebarTrigger } from '../../components/ui/sidebar.tsx';

interface AppTopbarProps {
    canGoBack: boolean;
    canGoForward: boolean;
    onGoBack: () => void;
    onGoForward: () => void;
}

export function AppTopbar({ canGoBack, canGoForward, onGoBack, onGoForward }: AppTopbarProps) {
    return (
        <AppShellTopbar>
            <AppShellTopbarSidebarSlot>
                <div className="no-drag flex items-center gap-1">
                    <SidebarTrigger />
                    <Button
                        aria-label="Go back"
                        disabled={!canGoBack}
                        onClick={onGoBack}
                        size="icon"
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4.5"
                            icon={ArrowLeft02Icon}
                            size={18}
                        />
                    </Button>
                    <Button
                        aria-label="Go forward"
                        disabled={!canGoForward}
                        onClick={onGoForward}
                        size="icon"
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-4.5"
                            icon={ArrowRight02Icon}
                            size={18}
                        />
                    </Button>
                </div>
            </AppShellTopbarSidebarSlot>
        </AppShellTopbar>
    );
}
