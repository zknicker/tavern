import { Trash2 } from '@hugeicons/core-free-icons';
import { ModelProviderBadge } from '../../../components/badges/model-provider-badge.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip.tsx';
import { getModelProviderConfig } from '../../../lib/model-provider-config.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';

interface InventoryModelCardProps {
    isDeleting: boolean;
    model: ModelInventoryOutput['providers'][number]['models'][number];
    onDelete: () => void;
    providerId: string;
}

export function InventoryModelCard({
    isDeleting,
    model,
    onDelete,
    providerId,
}: InventoryModelCardProps) {
    const providerConfig = getModelProviderConfig(providerId);

    return (
        <Card className="h-full justify-between p-4 transition-colors hover:border-border-strong">
            <div>
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="font-medium text-base text-foreground leading-6">
                            {model.displayName}
                        </p>
                        <p className="mt-1 truncate font-medium text-meta text-muted-foreground/90">
                            {model.ref}
                        </p>
                    </div>
                    <DeleteModelButton
                        disabled={!model.canDelete || isDeleting}
                        isDeleting={isDeleting}
                        label={model.displayName}
                        onDelete={onDelete}
                        usageLabels={model.usageLabels}
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <ModelProviderBadge
                    color={providerConfig.color}
                    icon={providerConfig.icon}
                    label={providerConfig.displayName}
                    size="sm"
                />
                {model.contextWindow ? (
                    <Badge size="sm" variant="secondary">
                        {formatContextWindow(model.contextWindow)}
                    </Badge>
                ) : null}
            </div>
        </Card>
    );
}

function DeleteModelButton({
    disabled,
    isDeleting,
    label,
    onDelete,
    usageLabels,
}: {
    disabled: boolean;
    isDeleting: boolean;
    label: string;
    onDelete: () => void;
    usageLabels: string[];
}) {
    const button = (
        <Button
            aria-label={`Delete ${label}`}
            className={usageLabels.length > 0 ? 'pointer-events-none' : undefined}
            disabled={disabled}
            loading={isDeleting}
            onClick={onDelete}
            size="icon-sm"
            type="button"
            variant="ghost"
        >
            <Icon className="size-4 text-destructive" icon={Trash2} />
        </Button>
    );

    if (usageLabels.length === 0) {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger
                render={<span className="inline-flex cursor-not-allowed">{button}</span>}
            />
            <TooltipContent align="end" className="max-w-72" side="top">
                <div className="space-y-2 p-2 text-sm leading-5">
                    <p className="font-medium text-foreground">
                        This model cannot be deleted because it is in use by:
                    </p>
                    <ol className="list-decimal pl-4 text-muted-foreground">
                        {usageLabels.map((usageLabel) => (
                            <li key={usageLabel}>{usageLabel}</li>
                        ))}
                    </ol>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

function formatContextWindow(value: number) {
    if (value >= 1000) {
        const rounded = value / 1000;
        return `${new Intl.NumberFormat(undefined, {
            maximumFractionDigits: value % 1000 === 0 ? 0 : 1,
        }).format(rounded)}K context`;
    }

    return `${value} context`;
}
