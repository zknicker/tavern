import { Refresh04Icon } from '@hugeicons-pro/core-solid-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../../../components/ui/tooltip.tsx';
import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';
import { type CapabilityView, groupCapabilities } from './agent-capabilities-view.ts';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityState = RuntimeCapability['state'];

const stateLabels: Record<CapabilityState, string> = {
    degraded: 'Degraded',
    healthy: 'Healthy',
    unauthorized: 'Unauthorized',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
};

function formatAbsolute(value: string | null) {
    if (!value) {
        return 'Never';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatRelative(value: string | null) {
    if (!value) {
        return 'never';
    }

    const diffMs = Date.now() - new Date(value).getTime();
    const diffSec = Math.round(diffMs / 1000);

    if (diffSec < 45) {
        return 'just now';
    }

    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin}m ago`;
    }

    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) {
        return `${diffHr}h ago`;
    }

    const diffDay = Math.round(diffHr / 24);
    return `${diffDay}d ago`;
}

function getDetail(capability: RuntimeCapability) {
    return capability.reason ?? capability.technicalMessage ?? null;
}

function getStateDotClass(state: CapabilityState): string {
    switch (state) {
        case 'healthy':
            return 'bg-success';
        case 'degraded':
            return 'bg-warning';
        case 'unauthorized':
        case 'unavailable':
            return 'bg-destructive';
        default:
            return 'bg-muted-foreground';
    }
}

function RelativeTime({ value }: { value: string | null }) {
    if (!value) {
        return <span>Never</span>;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="cursor-default" />}>
                {formatRelative(value)}
            </TooltipTrigger>
            <TooltipContent>{formatAbsolute(value)}</TooltipContent>
        </Tooltip>
    );
}

function CapabilityTooltipContent({ capability }: { capability: RuntimeCapability }) {
    const detail = getDetail(capability);
    const isHealthy = capability.state === 'healthy';

    return (
        <div className="grid gap-0.5">
            <p className="font-medium">{stateLabels[capability.state]}</p>
            {detail ? <p className="text-neutral-300">{detail}</p> : null}
            <p className="text-neutral-300">Checked {formatAbsolute(capability.checkedAt)}</p>
            {!isHealthy && capability.lastHealthyAt ? (
                <p className="text-neutral-300">
                    Last healthy {formatAbsolute(capability.lastHealthyAt)}
                </p>
            ) : null}
        </div>
    );
}

export function AgentCapabilitiesSummary({
    capabilities,
    emptyLabel = 'No capability checks recorded.',
    onCapabilityClick,
    onCapabilityRefresh,
    refreshingCapability,
}: {
    capabilities: RuntimeConnection['capabilities'];
    emptyLabel?: string;
    onCapabilityClick?: (capability: RuntimeCapability) => void;
    onCapabilityRefresh?: (capability: RuntimeCapability) => void;
    refreshingCapability?: RuntimeCapability['capability'] | null;
}) {
    if (capabilities.length === 0) {
        return (
            <div className="rounded-md bg-muted px-2 py-1.5">
                <p className="text-meta text-muted-foreground">{emptyLabel}</p>
            </div>
        );
    }

    const groups = groupCapabilities(capabilities);

    return (
        <TooltipProvider>
            <div className="grid gap-3">
                {groups.map((group) => (
                    <section className="grid gap-1.5" key={group.category.id}>
                        <h4 className="px-2 font-medium text-muted-foreground text-xs">
                            {group.category.label}
                        </h4>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-muted px-2 py-2 sm:grid-cols-2">
                            {group.items.map((view) => (
                                <CapabilityRow
                                    key={view.item.capability}
                                    onCapabilityClick={onCapabilityClick}
                                    onCapabilityRefresh={onCapabilityRefresh}
                                    refreshingCapability={refreshingCapability}
                                    view={view}
                                />
                            ))}
                        </dl>
                    </section>
                ))}
            </div>
        </TooltipProvider>
    );
}

function CapabilityRow({
    onCapabilityClick,
    onCapabilityRefresh,
    refreshingCapability,
    view,
}: {
    onCapabilityClick?: (capability: RuntimeCapability) => void;
    onCapabilityRefresh?: (capability: RuntimeCapability) => void;
    refreshingCapability?: RuntimeCapability['capability'] | null;
    view: CapabilityView;
}) {
    const capability = view.item;
    const isClickable = Boolean(onCapabilityClick);

    return (
        <div className="group flex min-w-0 items-center justify-between gap-3">
            <dt className="flex h-5 min-w-0 items-center gap-1 text-sm">
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                    {onCapabilityRefresh ? (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <button
                                        aria-label={`Refresh ${view.label}`}
                                        className="inline-flex size-4 items-center justify-center rounded-sm outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={refreshingCapability === capability.capability}
                                        onClick={() => onCapabilityRefresh(capability)}
                                        type="button"
                                    />
                                }
                            >
                                <span
                                    aria-hidden="true"
                                    className={`size-2 rounded-full ${refreshingCapability === capability.capability ? 'hidden' : 'group-hover:hidden'} ${getStateDotClass(capability.state)}`}
                                />
                                <Icon
                                    className={`size-3 ${refreshingCapability === capability.capability ? 'block animate-spin' : 'hidden group-hover:block'}`}
                                    icon={Refresh04Icon}
                                />
                            </TooltipTrigger>
                            <TooltipContent>Refresh capability</TooltipContent>
                        </Tooltip>
                    ) : (
                        <span
                            aria-hidden="true"
                            className={`size-2 rounded-full ${getStateDotClass(capability.state)}`}
                        />
                    )}
                </span>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <button
                                aria-disabled={!isClickable}
                                className={`inline-flex min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => {
                                    if (isClickable) {
                                        onCapabilityClick?.(capability);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        isClickable &&
                                        (event.key === 'Enter' || event.key === ' ')
                                    ) {
                                        event.preventDefault();
                                        onCapabilityClick?.(capability);
                                    }
                                }}
                                tabIndex={isClickable ? 0 : -1}
                                type="button"
                            />
                        }
                    >
                        <span className="truncate font-mono text-foreground">{view.label}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <CapabilityTooltipContent capability={capability} />
                    </TooltipContent>
                </Tooltip>
            </dt>
            <dd className="flex h-5 shrink-0 items-center gap-1 font-mono text-meta text-muted-foreground tabular-nums">
                <RelativeTime value={capability.checkedAt} />
            </dd>
        </div>
    );
}
