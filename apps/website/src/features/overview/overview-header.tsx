export function OverviewHeader({
    heading,
    jobCount,
    memoryCount,
    sessionsCount,
    workerCount,
}: {
    heading: string;
    jobCount: number;
    memoryCount: number;
    sessionsCount: number;
    workerCount: number;
}) {
    return (
        <>
            <h1 className="text-center font-bold text-3xl text-foreground tracking-tight">
                {heading}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
                <span>
                    <span className="font-medium text-foreground/80">{sessionsCount}</span> sessions
                </span>
                <span className="text-border-strong">&middot;</span>
                <span>
                    <span className="font-medium text-foreground/80">{jobCount}</span> jobs
                </span>
                <span className="text-border-strong">&middot;</span>
                <span>
                    <span className="font-medium text-foreground/80">{workerCount}</span> background
                    tasks
                </span>
                <span className="text-border-strong">&middot;</span>
                <span>
                    <span className="font-medium text-foreground/80">{memoryCount}</span> memories
                </span>
            </div>
        </>
    );
}
