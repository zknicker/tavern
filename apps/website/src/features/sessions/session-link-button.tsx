import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { cn } from '../../lib/utils.ts';

export function SessionLinkButton({
    className,
    label,
    sessionKey,
    subtitle,
    title,
    tone = 'neutral',
}: {
    className?: string;
    label?: string;
    sessionKey: string;
    subtitle?: string | null;
    title: string;
    tone?: 'amber' | 'neutral' | 'sky';
}) {
    const { openSession } = useSessionDrawer();

    function handleClick() {
        openSession(sessionKey);
    }

    return (
        <button
            className={cn(
                'flex min-w-0 flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                tone === 'amber'
                    ? 'border-[color:var(--warning-border)] bg-[var(--warning-bg)] hover:bg-[color:color-mix(in_srgb,var(--warning-bg),var(--warning)_10%)]'
                    : tone === 'sky'
                      ? 'border-[color:var(--info-border)] bg-[var(--info-bg)] hover:bg-[color:color-mix(in_srgb,var(--info-bg),var(--info)_10%)]'
                      : 'border-border/60 bg-muted/30 hover:bg-muted/50',
                className
            )}
            onClick={handleClick}
            type="button"
        >
            {label ? (
                <span
                    className={cn(
                        'font-medium text-caption uppercase tracking-[0.16em]',
                        tone === 'amber'
                            ? 'text-warning'
                            : tone === 'sky'
                              ? 'text-info'
                              : 'text-muted-foreground'
                    )}
                >
                    {label}
                </span>
            ) : null}
            <span className="min-w-0 truncate text-foreground/90 text-sm">{title}</span>
            {subtitle ? (
                <span
                    className={cn(
                        'min-w-0 truncate text-caption',
                        tone === 'amber'
                            ? 'text-warning/78'
                            : tone === 'sky'
                              ? 'text-info/78'
                              : 'text-muted-foreground/80'
                    )}
                >
                    {subtitle}
                </span>
            ) : null}
        </button>
    );
}
