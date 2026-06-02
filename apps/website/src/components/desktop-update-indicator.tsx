import { SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import { CheckmarkCircle01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useEffect, useState } from 'react';
import { useDesktopUpdate } from '../hooks/desktop/use-desktop-update.ts';
import { cn } from '../lib/utils.ts';
import { Icon } from './ui/icon.tsx';
import { Button } from './ui/primitives/button.tsx';

interface DesktopUpdateIndicatorProps {
    placement?: 'floating' | 'inline';
}

export function DesktopUpdateIndicator({ placement = 'inline' }: DesktopUpdateIndicatorProps) {
    const { status, updateAndRestart } = useDesktopUpdate();
    const [shouldRender, setShouldRender] = useState(false);
    const isVisible =
        status.phase === 'available' ||
        status.phase === 'downloading' ||
        status.phase === 'ready' ||
        status.phase === 'restarting';

    useEffect(() => {
        if (!isVisible) {
            setShouldRender(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShouldRender(true);
        }, 360);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isVisible]);

    if (!(isVisible && shouldRender)) {
        return null;
    }

    const canAct = status.phase === 'available' || status.phase === 'ready';
    const label = getUpdateLabel(status);
    const progress = status.phase === 'downloading' ? status.progress : undefined;

    return (
        <div
            className={cn(
                'no-drag pointer-events-auto z-50',
                placement === 'floating'
                    ? 'absolute top-3 right-4 animate-[desktop-update-indicator-floating-in_240ms_cubic-bezier(0.23,1,0.32,1)_both]'
                    : 'relative -mr-[6px] w-7 shrink-0 animate-[desktop-update-indicator-inline-in_280ms_cubic-bezier(0.23,1,0.32,1)_both] overflow-visible'
            )}
        >
            <Button
                aria-label={label}
                className="size-7 rounded-[var(--main-radius)] shadow-none before:rounded-[calc(var(--main-radius)-1px)]"
                disabled={!canAct}
                loading={status.phase === 'restarting'}
                onClick={() => {
                    updateAndRestart().catch(() => undefined);
                }}
                size="icon-sm"
                title={getUpdateDetail(status)}
                type="button"
                variant="brand-soft"
            >
                <UpdateIcon phase={status.phase} progress={progress} />
            </Button>
        </div>
    );
}

function UpdateIcon({
    phase,
    progress,
}: {
    phase: 'available' | 'downloading' | 'ready' | 'restarting';
    progress?: number;
}) {
    if (phase === 'downloading') {
        return <ProgressDonut progress={progress ?? 0} />;
    }

    if (phase === 'ready') {
        return (
            <Icon
                aria-hidden="true"
                className="size-4.5 shrink-0"
                icon={CheckmarkCircle01Icon}
                size={18}
                strokeWidth={2.4}
            />
        );
    }

    return (
        <Icon
            aria-hidden="true"
            className="size-4.5 shrink-0"
            icon={phase === 'restarting' ? SystemUpdate01Icon : Download04Icon}
            size={18}
            strokeWidth={2.4}
        />
    );
}

function ProgressDonut({ progress }: { progress: number }) {
    const progressPercent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const progressDegrees = progressPercent * 3.6;

    return (
        <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full"
            style={{
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
                background: `conic-gradient(var(--brand) 0deg ${progressDegrees}deg, color-mix(in srgb, var(--brand), transparent 78%) ${progressDegrees}deg 360deg)`,
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
            }}
        />
    );
}

function getUpdateLabel(status: {
    phase: 'available' | 'downloading' | 'ready' | 'restarting';
    progress?: number;
}) {
    switch (status.phase) {
        case 'available':
            return 'Update';
        case 'downloading':
            return `Updating ${Math.round((status.progress ?? 0) * 100)}%`;
        case 'ready':
            return 'Restart To Apply Update';
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
            return `Tavern ${status.version} is available. Download it now and restart when ready.`;
        case 'downloading':
            return `Tavern ${status.version} is downloading in the background. Hang tight.`;
        case 'ready':
            return `Tavern ${status.version} is installed. Restart to finish updating.`;
        case 'restarting':
            return 'Tavern is restarting to finish the update.';
    }
}
