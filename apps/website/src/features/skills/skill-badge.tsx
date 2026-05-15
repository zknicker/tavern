import { CubeIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';

export function SkillBadge({ className, name }: { className?: string; name: string }) {
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card py-1 pr-2.5 pl-2 font-medium text-foreground text-sm shadow-xs',
                className
            )}
            title={name}
        >
            <Icon className="size-3.5 text-muted-foreground" icon={CubeIcon} />
            <span className="truncate">{name}</span>
        </span>
    );
}
