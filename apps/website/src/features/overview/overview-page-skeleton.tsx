import { Skeleton } from '../../components/ui/skeleton.tsx';

export function OverviewPageSkeleton() {
    return (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
            <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
                {/* Greeting */}
                <Skeleton className="h-9 w-80 rounded-full" />
                <div className="mt-3 flex gap-3">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                    <Skeleton className="h-4 w-18 rounded-full" />
                </div>

                {/* Prompt box */}
                <Skeleton className="mt-8 h-36 w-full rounded-2xl" />
            </div>
        </div>
    );
}
