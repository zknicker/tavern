import { Card, CardContent } from '../../components/ui/card.tsx';
import { Skeleton } from '../../components/ui/skeleton.tsx';

const appGridSkeletonIds = Array.from({ length: 6 }, (_, index) => `app-grid-skeleton-${index}`);
const appListSkeletonIds = Array.from({ length: 5 }, (_, index) => `app-list-skeleton-${index}`);
const appSplitViewSkeletonIds = Array.from(
    { length: 8 },
    (_, index) => `app-split-view-skeleton-${index}`
);
const appDetailBlockSkeletonIds = Array.from(
    { length: 3 },
    (_, index) => `app-detail-block-skeleton-${index}`
);

export function GridPageSkeleton() {
    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <Skeleton className="h-10 w-full" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {appGridSkeletonIds.map((id) => (
                    <Card key={id}>
                        <CardContent className="space-y-4 p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-5/6" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export function ListPageSkeleton() {
    return (
        <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between gap-4 border-border border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-9 w-28" />
            </div>

            <div className="flex flex-col gap-2 p-4">
                {appListSkeletonIds.map((id) => (
                    <Card key={id}>
                        <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-44" />
                                    <Skeleton className="h-3 w-80 max-w-full" />
                                    <Skeleton className="h-3 w-64 max-w-full" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <Skeleton className="size-8 rounded-md" />
                                    <Skeleton className="size-8 rounded-md" />
                                    <Skeleton className="size-8 rounded-md" />
                                </div>
                            </div>
                            <Skeleton className="h-3 w-28" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export function SplitViewSkeleton() {
    return (
        <div className="flex flex-1 overflow-hidden">
            <div className="flex w-80 flex-col border-border border-r">
                <div className="space-y-3 p-3">
                    <Skeleton className="h-10 w-full" />
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-7 w-12" />
                        <Skeleton className="h-7 w-16" />
                        <Skeleton className="h-7 w-12" />
                    </div>
                </div>

                <div className="flex flex-col">
                    {appSplitViewSkeletonIds.map((id) => (
                        <div className="space-y-2 border-border border-b px-3 py-3" key={id}>
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-1 flex-col p-6">
                <div className="space-y-3">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-96 max-w-full" />
                    <div className="flex gap-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-28" />
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {appDetailBlockSkeletonIds.map((id) => (
                        <Card key={id}>
                            <CardContent className="space-y-3 p-4">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-5/6" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
