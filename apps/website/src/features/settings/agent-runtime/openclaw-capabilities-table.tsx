import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../../../components/ui/tooltip.tsx';
import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityState = RuntimeCapability['state'];

const capabilityLabels: Partial<Record<RuntimeCapability['capability'], string>> = {
    cronRuns: 'cron runs',
    skillMaterialization: 'skill management',
};

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

function getCapabilityLabel(capability: RuntimeCapability) {
    return capabilityLabels[capability.capability] ?? capability.capability;
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
            {detail ? <p className="text-muted-foreground">{detail}</p> : null}
            <p className="text-muted-foreground">Checked {formatAbsolute(capability.checkedAt)}</p>
            {!isHealthy && capability.lastHealthyAt ? (
                <p className="text-muted-foreground">
                    Last healthy {formatAbsolute(capability.lastHealthyAt)}
                </p>
            ) : null}
        </div>
    );
}

export function OpenClawCapabilitiesSummary({
    capabilities,
    emptyLabel = 'No capability checks recorded.',
    onCapabilityClick,
}: {
    capabilities: RuntimeConnection['capabilities'];
    emptyLabel?: string;
    onCapabilityClick?: (capability: RuntimeCapability) => void;
}) {
    if (capabilities.length === 0) {
        return (
            <div className="-mx-2 rounded-md bg-muted px-2 py-1.5">
                <p className="text-meta text-muted-foreground">{emptyLabel}</p>
            </div>
        );
    }

    const sorted = [...capabilities].sort((a, b) => a.capability.localeCompare(b.capability));

    return (
        <TooltipProvider>
            <dl className="-mx-2 grid grid-cols-1 gap-x-6 gap-y-2 rounded-md bg-muted px-2 py-2 sm:grid-cols-2">
                {sorted.map((capability) => {
                    const isClickable = Boolean(onCapabilityClick);

                    return (
                        <div
                            className="flex min-w-0 items-baseline justify-between gap-3"
                            key={capability.capability}
                        >
                            <dt className="min-w-0 text-sm">
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <button
                                                aria-disabled={!isClickable}
                                                className={`inline-flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
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
                                        <span
                                            aria-hidden="true"
                                            className={`size-2 shrink-0 rounded-full ${getStateDotClass(capability.state)}`}
                                        />
                                        <span className="truncate font-mono text-foreground">
                                            {getCapabilityLabel(capability)}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <CapabilityTooltipContent capability={capability} />
                                    </TooltipContent>
                                </Tooltip>
                            </dt>
                            <dd className="shrink-0 font-mono text-meta text-muted-foreground tabular-nums">
                                <RelativeTime value={capability.checkedAt} />
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </TooltipProvider>
    );
}
