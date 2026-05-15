import type { TooltipProps } from 'recharts';

export function UsageSpendTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!(active && payload?.length)) {
        return null;
    }

    const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);
    const nonZero = payload.filter((entry) => (entry.value ?? 0) > 0);

    return (
        <div className="rounded-lg border border-border/50 bg-popover/85 px-3 py-2.5 shadow-xl backdrop-blur-md">
            <p className="mb-1.5 font-medium text-caption text-muted-foreground">{label}</p>
            <div className="space-y-1">
                {nonZero.map((entry) => (
                    <div className="flex items-center justify-between gap-6" key={entry.dataKey}>
                        <div className="flex items-center gap-1.5">
                            <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-foreground/80 text-xs">{entry.name}</span>
                        </div>
                        <span className="font-medium text-foreground text-xs tabular-nums">
                            ${Number(entry.value).toFixed(2)}
                        </span>
                    </div>
                ))}
            </div>
            {nonZero.length > 1 ? (
                <div className="mt-1.5 flex items-center justify-between border-border/50 border-t pt-1.5">
                    <span className="text-caption text-muted-foreground">Total</span>
                    <span className="font-semibold text-foreground text-xs tabular-nums">
                        ${total.toFixed(2)}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
