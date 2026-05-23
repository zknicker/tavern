import { Skeleton } from '../../components/ui/skeleton.tsx';

export function JobsPageSkeleton() {
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <JobSummarySkeleton />
        </div>
    );
}

function JobSummarySkeleton() {
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-3 pb-4">
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-3 w-64" />
                <div className="h-px flex-1 bg-border" />
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
                {Array.from({ length: 3 }, (_, index) => `jobs-summary-skeleton-${index + 1}`).map(
                    (id, index) => (
                        <div className="contents" key={id}>
                            {index > 0 ? <div className="h-px bg-border" /> : null}
                            <div className="flex items-center gap-3 px-4 py-3">
                                <Skeleton className="size-2 shrink-0 rounded-full" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <Skeleton className="h-3.5 w-40" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-3 w-24 shrink-0" />
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
