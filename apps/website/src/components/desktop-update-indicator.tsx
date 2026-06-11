import { AlertCircleIcon, SystemUpdate01Icon } from '@hugeicons/core-free-icons';
import { CheckmarkCircle01Icon, Download04Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type TavernUpdateStatus, useTavernUpdate } from '../hooks/desktop/use-tavern-update.ts';
import { cn } from '../lib/utils.ts';
import { Icon } from './ui/icon.tsx';
import { Button } from './ui/primitives/button.tsx';
import { toastManager } from './ui/toast.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

interface DesktopUpdateIndicatorProps {
    placement?: 'floating' | 'inline';
}

export function DesktopUpdateIndicator({ placement = 'inline' }: DesktopUpdateIndicatorProps) {
    const { status, updateAndRestart } = useTavernUpdate();
    const navigate = useNavigate();
    const [shouldRender, setShouldRender] = useState(false);
    const isVisible =
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'staging-runtime' ||
        status.phase === 'downloading-app' ||
        status.phase === 'failed' ||
        status.phase === 'runtime-disconnected' ||
        status.phase === 'ready' ||
        status.phase === 'restarting-runtime' ||
        status.phase === 'restarting-app';

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

    const canAct =
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'failed' ||
        status.phase === 'runtime-disconnected' ||
        status.phase === 'ready';
    const label = getUpdateLabel(status);
    const progress = status.phase === 'downloading-app' ? status.progress : undefined;

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
                            onClick={() => {
                                if (status.phase === 'runtime-disconnected') {
                                    navigate('/dashboard/settings/agent-runtime');
                                    return;
                                }

                                toastManager.add({
                                    title: 'Runtime update downloading…',
                                    type: 'info',
                                });
                                updateAndRestart().catch(() => undefined);
                            }}
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
                            <UpdateIcon phase={status.phase} progress={progress} />
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

function UpdateIcon({
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
            icon={
                phase === 'restarting-runtime' || phase === 'restarting-app'
                    ? SystemUpdate01Icon
                    : Download04Icon
            }
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

function getUpdateLabel(status: TavernUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return 'Update';
        case 'app-update-required':
            return 'Tavern Update Required';
        case 'staging-runtime':
            return 'Staging Runtime';
        case 'downloading-app':
            return `Updating ${Math.round((status.progress ?? 0) * 100)}%`;
        case 'ready':
            return 'Ready to install';
        case 'failed':
            return 'Update Failed';
        case 'runtime-disconnected':
            return 'Runtime Disconnected';
        case 'restarting-runtime':
            return 'Restarting Runtime';
        case 'restarting-app':
            return 'Restarting';
        default:
            return 'Update';
    }
}
