import { ArrowDown01Icon, SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { useDesktopUpdate } from '../hooks/desktop/use-desktop-update.ts';
import { Icon } from './ui/icon.tsx';
import { Button } from './ui/primitives/button.tsx';

export function DesktopUpdateIndicator() {
    const { status, updateAndRestart } = useDesktopUpdate();
    const [ellipsisFrame, setEllipsisFrame] = React.useState(0);
    const isVisible =
        status.phase === 'available' ||
        status.phase === 'downloading' ||
        status.phase === 'ready' ||
        status.phase === 'restarting';

    React.useEffect(() => {
        if (!isVisible || status.phase === 'ready') {
            setEllipsisFrame(0);
            return;
        }

        const intervalId = window.setInterval(() => {
            setEllipsisFrame((current) => (current + 1) % 4);
        }, 640);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [isVisible, status.phase]);

    if (!isVisible) {
        return null;
    }

    const progressPercent =
        status.phase === 'downloading' ? Math.round(status.progress * 100) : 100;
    const label = getUpdateLabel(status.phase);
    const detail = getUpdateDetail(status);
    const ellipsis = '.'.repeat(ellipsisFrame);
    const canRestart = status.phase === 'ready';
    const canInstall = status.phase === 'available';

    return (
        <div className="no-drag pointer-events-none fixed top-3 right-4 z-50">
            <div className="group pointer-events-auto relative flex items-center gap-2 rounded-full border border-border/70 bg-popover/92 px-2.5 py-1.5 text-foreground text-sm shadow-[0_12px_36px_rgb(15_23_42_/_0.18),0_2px_8px_rgb(15_23_42_/_0.08)] backdrop-blur-xl">
                <span
                    aria-hidden="true"
                    className="relative flex size-4 shrink-0 items-center justify-center rounded-full border border-border/70"
                    style={{
                        background:
                            status.phase === 'downloading'
                                ? getProgressWedge(progressPercent)
                                : 'var(--primary)',
                    }}
                >
                    <Icon
                        className="size-2.5 text-primary-foreground"
                        icon={status.phase === 'downloading' ? ArrowDown01Icon : SystemUpdate01Icon}
                        strokeWidth={2.2}
                    />
                </span>
                <span className="font-medium text-sm">
                    {label}
                    {status.phase === 'downloading' ? (
                        <span className="inline-block min-w-3 text-left tabular-nums">
                            {ellipsis}
                        </span>
                    ) : null}
                </span>
                {status.phase === 'downloading' ? (
                    <span className="text-muted-foreground text-sm tabular-nums">
                        {progressPercent}%
                    </span>
                ) : null}
                {canInstall || canRestart ? (
                    <Button
                        className="h-6 rounded-full px-2 text-sm"
                        onClick={() => {
                            updateAndRestart().catch(() => undefined);
                        }}
                        size="xs"
                        variant={canRestart ? 'default' : 'secondary'}
                    >
                        {canRestart ? 'Restart' : 'Update'}
                    </Button>
                ) : null}
                <div className="pointer-events-none absolute top-[calc(100%+8px)] right-0 w-64 translate-y-1 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="rounded-lg border border-border/70 bg-popover/96 px-3 py-2 text-popover-foreground shadow-[0_16px_44px_rgb(15_23_42_/_0.18),0_3px_10px_rgb(15_23_42_/_0.08)] backdrop-blur-xl">
                        <p className="text-muted-foreground text-sm leading-5">{detail}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getProgressWedge(progressPercent: number) {
    const clamped = Math.max(1, Math.min(progressPercent, 100));
    const sweep = clamped * 3.6;
    return `conic-gradient(from 0deg, var(--primary) 0deg, var(--primary) ${sweep}deg, var(--muted) ${sweep}deg, var(--muted) 360deg)`;
}

function getUpdateLabel(phase: 'available' | 'downloading' | 'ready' | 'restarting') {
    switch (phase) {
        case 'available':
            return 'Update available';
        case 'downloading':
            return 'Updating';
        case 'ready':
            return 'Update ready';
        case 'restarting':
            return 'Restarting';
    }
}

function getUpdateDetail(status: {
    phase: 'available' | 'downloading' | 'ready' | 'restarting';
    progress?: number;
    version: string;
}) {
    switch (status.phase) {
        case 'available':
            return `Tavern ${status.version} is available.`;
        case 'downloading':
            return `Tavern ${status.version} is downloading in the background.`;
        case 'ready':
            return `Tavern ${status.version} is installed. Restart to finish updating.`;
        case 'restarting':
            return 'Tavern is restarting to finish the update.';
    }
}
