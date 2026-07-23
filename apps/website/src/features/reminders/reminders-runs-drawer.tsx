import {
    Drawer,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { RemindersRunsCard } from './reminders-runs-card.tsx';

interface RemindersRunsDrawerProps {
    anchorChatId: string | null;
    isOpen: boolean;
    isPending: boolean;
    onClose: () => void;
    reminderName: string | null;
    runs: ReminderRunsOutput['runs'];
}

// Ported from cron-runs-drawer.tsx.
export function RemindersRunsDrawer({
    anchorChatId,
    isOpen,
    isPending,
    onClose,
    reminderName,
    runs,
}: RemindersRunsDrawerProps) {
    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen} position="right">
            <DrawerPopup className="w-[min(96vw,66rem)] max-w-[min(96vw,66rem)]" variant="inset">
                <DrawerHeader className="px-8 pt-7 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <DrawerTitle className="shrink-0">Run history</DrawerTitle>
                        {reminderName ? (
                            <span className="min-w-0 truncate rounded-md bg-accent px-2 py-1 font-medium text-muted-foreground text-sm">
                                {reminderName}
                            </span>
                        ) : null}
                    </div>
                </DrawerHeader>
                <DrawerPanel className="!p-0">
                    <RemindersRunsCard
                        anchorChatId={anchorChatId}
                        isPending={isPending}
                        runs={runs}
                    />
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}
