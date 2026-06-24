import { TavernUpdateIcon } from '../../components/desktop-update-indicator.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import { useTavernUpdateIndicator } from '../../hooks/desktop/use-tavern-update-indicator.ts';

export function SidebarUpdateMenuItem() {
    const update = useTavernUpdateIndicator();

    if (!update) {
        return null;
    }

    const isIssue =
        update.status.phase === 'app-update-required' ||
        update.status.phase === 'failed' ||
        update.status.phase === 'runtime-disconnected';

    return (
        <SidebarMenuItem>
            <Button
                aria-label={`${update.sidebarLabel}: ${update.status.detail}`}
                className="max-w-full justify-start px-2"
                disabled={!update.canAct}
                onClick={update.activate}
                size="sm"
                variant={isIssue ? 'destructive-soft' : 'brand-soft'}
            >
                <TavernUpdateIcon phase={update.status.phase} progress={update.progress} />
                <span className="truncate leading-none">{update.sidebarLabel}</span>
            </Button>
        </SidebarMenuItem>
    );
}
