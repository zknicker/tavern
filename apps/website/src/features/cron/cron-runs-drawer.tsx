import {
    Drawer,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { CronRunsCard } from './cron-runs-card.tsx';

interface CronRunsDrawerProps {
    deliveryDestinationLabel: string | null;
    isOpen: boolean;
    isPending: boolean;
    jobName: string | null;
    onClose: () => void;
    runs: CronRunsOutput['runs'];
}

export function CronRunsDrawer({
    deliveryDestinationLabel,
    isOpen,
    isPending,
    jobName,
    onClose,
    runs,
}: CronRunsDrawerProps) {
    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen} position="right">
            <DrawerPopup className="w-[min(96vw,66rem)] max-w-[min(96vw,66rem)]" variant="inset">
                <DrawerHeader className="px-8 pt-7 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <DrawerTitle className="shrink-0">Run history</DrawerTitle>
                        {jobName ? (
                            <span className="min-w-0 truncate rounded-md bg-accent px-2 py-1 font-medium text-muted-foreground text-sm">
                                {jobName}
                            </span>
                        ) : null}
                    </div>
                </DrawerHeader>
                <DrawerPanel className="!p-0">
                    <CronRunsCard
                        deliveryDestinationLabel={deliveryDestinationLabel}
                        isPending={isPending}
                        runs={runs}
                    />
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}
