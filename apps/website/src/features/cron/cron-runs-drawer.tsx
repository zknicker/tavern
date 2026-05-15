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
    isOpen: boolean;
    isPending: boolean;
    jobName: string | null;
    onClose: () => void;
    runs: CronRunsOutput['runs'];
}

export function CronRunsDrawer({ isOpen, isPending, jobName, onClose, runs }: CronRunsDrawerProps) {
    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen} position="right">
            <DrawerPopup className="w-[min(96vw,66rem)] max-w-[min(96vw,66rem)]" variant="inset">
                <DrawerHeader>
                    <DrawerTitle>Run history</DrawerTitle>
                    {jobName ? <p className="text-muted-foreground text-sm">{jobName}</p> : null}
                </DrawerHeader>
                <DrawerPanel>
                    <CronRunsCard isPending={isPending} runs={runs} />
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}
