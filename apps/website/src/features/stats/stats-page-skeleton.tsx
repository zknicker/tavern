import { Skeleton } from '../../components/ui/skeleton.tsx';
import { UsageModulesSkeleton } from '../overview/usage-modules.tsx';

export function StatsPageSkeleton() {
    return (
        <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-6">
            <Skeleton className="h-20 w-full max-w-3xl rounded-2xl" />
            <UsageModulesSkeleton />
        </div>
    );
}
