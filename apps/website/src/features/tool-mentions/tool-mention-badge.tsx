import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { getToolMentionAppearance } from './tool-mention-registry.tsx';
import type { ToolMentionKind } from './tool-mention-types.ts';

export function ToolMentionBadge({
    className,
    id,
    kind,
    label,
    variant = 'badge',
}: {
    className?: string;
    id: string;
    kind: ToolMentionKind;
    label: string;
    variant?: 'badge' | 'text';
}) {
    const appearance = getToolMentionAppearance({ id, kind, label });

    if (variant === 'text') {
        return (
            <span
                className={cn(
                    'inline rounded-[0.25rem] align-baseline',
                    appearance.tone === 'app' &&
                        'bg-sky-500/12 text-sky-950 shadow-[0_0_0_1px_--theme(--color-sky-500/20%)] dark:text-sky-100',
                    appearance.tone === 'skill' &&
                        'bg-emerald-500/12 text-emerald-950 shadow-[0_0_0_1px_--theme(--color-emerald-500/20%)] dark:text-emerald-100',
                    appearance.tone === 'tool' &&
                        'bg-muted text-foreground shadow-[0_0_0_1px_--theme(--color-border)]',
                    className
                )}
                contentEditable={false}
                title={label}
            >
                {label}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 align-baseline font-medium text-inline-meta leading-[1.35] shadow-xs',
                appearance.tone === 'app' &&
                    'border-sky-500/20 bg-sky-500/10 text-sky-950 dark:text-sky-100',
                appearance.tone === 'skill' &&
                    'border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
                appearance.tone === 'tool' && 'border-border bg-card text-foreground',
                className
            )}
            contentEditable={false}
            title={label}
        >
            <Icon className="size-3.5 shrink-0 opacity-75" icon={appearance.icon} />
            <span className="min-w-0 truncate">{label}</span>
        </span>
    );
}
