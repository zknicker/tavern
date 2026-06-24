import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { CheckmarkCircle01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { TavernUpdateStatus } from '../hooks/desktop/use-tavern-update.ts';
import { useTavernUpdateIndicator } from '../hooks/desktop/use-tavern-update-indicator.ts';
import { cn } from '../lib/utils.ts';
import { Icon } from './ui/icon.tsx';
import { Button } from './ui/primitives/button.tsx';
import { Spinner } from './ui/spinner.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

interface DesktopUpdateIndicatorProps {
    placement?: 'floating' | 'inline';
}

export function DesktopUpdateIndicator({ placement = 'inline' }: DesktopUpdateIndicatorProps) {
    const update = useTavernUpdateIndicator();

    if (!update) {
        return null;
    }

    const { canAct, label, progress, status } = update;

    return (
        <div
            className={cn(
                'no-drag pointer-events-auto z-50',
                placement === 'floating'
                    ? 'absolute top-3 right-4 animate-[desktop-update-indicator-floating-in_240ms_cubic-bezier(0.23,1,0.32,1)_both]'
                    : 'relative -mr-[6px] w-7 shrink-0 animate-[desktop-update-indicator-inline-in_280ms_cubic-bezier(0.23,1,0.32,1)_both] overflow-visible'
            )}
        >
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            aria-label={label}
                            className={cn(
                                'size-7 rounded-[var(--main-radius)] shadow-none before:rounded-[calc(var(--main-radius)-1px)] [&_[data-slot=button-loading-indicator]]:size-4',
                                (status.phase === 'runtime-disconnected' ||
                                    status.phase === 'app-update-required' ||
                                    status.phase === 'failed') &&
                                    'bg-error-bg hover:bg-error-bg data-pressed:bg-error-bg'
                            )}
                            disabled={!canAct}
                            loading={
                                status.phase === 'restarting-runtime' ||
                                status.phase === 'restarting-app'
                            }
                            onClick={update.activate}
                            size="icon-sm"
                            type="button"
                            variant={
                                status.phase === 'runtime-disconnected'
                                    ? 'destructive-soft'
                                    : status.phase === 'app-update-required' ||
                                        status.phase === 'failed'
                                      ? 'destructive-soft'
                                      : 'brand-soft'
                            }
                        >
                            <TavernUpdateIcon phase={status.phase} progress={progress} />
                        </Button>
                    }
                />
                <TooltipContent className="max-w-[18rem]" side="bottom">
                    {status.phase === 'runtime-disconnected' ? (
                        <div className="py-0.5">{status.detail}</div>
                    ) : (
                        <div className="grid gap-1 py-0.5">
                            <div className="font-medium">{label}</div>
                            <div>{status.detail}</div>
                        </div>
                    )}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

export function TavernUpdateIcon({
    phase,
    progress,
}: {
    phase: TavernUpdateStatus['phase'];
    progress?: number;
}) {
    if (phase === 'downloading-app') {
        return <ProgressDonut progress={progress ?? 0} />;
    }

    if (phase === 'staging-runtime') {
        return <IndeterminateDonut />;
    }

    if (phase === 'restarting-runtime' || phase === 'restarting-app') {
        return <Spinner aria-hidden="true" className="size-4 shrink-0" />;
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

    if (phase === 'runtime-disconnected') {
        return (
            <Icon
                aria-hidden="true"
                className="size-4.5 shrink-0"
                icon={AlertCircleIcon}
                size={18}
                strokeWidth={2.4}
            />
        );
    }

    return (
        <Icon
            aria-hidden="true"
            className="size-4.5 shrink-0"
            icon={Download04Icon}
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

function IndeterminateDonut() {
    return (
        <span
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin rounded-full"
            style={{
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
                background:
                    'conic-gradient(var(--brand) 0deg 90deg, color-mix(in srgb, var(--brand), transparent 78%) 90deg 360deg)',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)',
            }}
        />
    );
}
