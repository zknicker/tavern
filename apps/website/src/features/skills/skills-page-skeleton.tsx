import { Skeleton } from '../../components/ui/skeleton.tsx';

export function SkillsPageSkeleton() {
    return (
        <div className="flex h-full min-h-0 items-center justify-center p-6">
            <Skeleton className="h-full w-full" />
        </div>
    );
}
