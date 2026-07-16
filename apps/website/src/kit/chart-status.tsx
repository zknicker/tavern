import { cn } from '../lib/utils.ts';

/** Loading, error, or empty text panel sized to sit in place of a chart body. */
export function KitChartStatus({
    framed = true,
    text,
    tone = 'muted',
}: {
    framed?: boolean;
    text: string;
    tone?: 'error' | 'muted';
}) {
    return (
        <div
            className={cn(
                'flex min-h-36 items-center justify-center px-3 text-center text-sm',
                framed && 'rounded-lg border border-border/70',
                tone === 'error' ? 'text-destructive-foreground' : 'text-muted-foreground'
            )}
        >
            {text}
        </div>
    );
}
