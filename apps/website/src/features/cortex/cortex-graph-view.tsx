import { CortexGraphCanvas } from './cortex-graph.tsx';
import type { CortexPageNode, CortexStatus } from './types.ts';
import { countLinks } from './utils.ts';

export function CortexGraphView({
    onSelect,
    pages,
    selectedSlug,
    status,
}: {
    onSelect: (slug: string) => void;
    pages: CortexPageNode[];
    selectedSlug: string | null;
    status: CortexStatus | null;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-3 border-border/70 border-b text-sm">
                <Metric label="Pages" value={status?.pageCount ?? pages.length} />
                <Metric label="Links" value={status?.linkCount ?? countLinks({ pages })} />
                <Metric
                    label="Encodings"
                    value={
                        status
                            ? `${status.encoding.currentCount}/${status.encoding.totalCount}`
                            : '0/0'
                    }
                />
            </div>
            <CortexGraphCanvas
                className="min-h-0 flex-1"
                onSelect={onSelect}
                pages={pages}
                selectedSlug={selectedSlug}
            />
        </div>
    );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0 border-border/70 border-r px-4 py-3 last:border-r-0">
            <div className="truncate text-muted-foreground text-xs">{label}</div>
            <div className="mt-1 truncate font-medium text-foreground text-sm">{value}</div>
        </div>
    );
}
