import { Link } from 'react-router-dom';

export function OverviewHeader({
    heading,
    jobCount,
    memoryCount,
    receipt,
    receiptTo,
    sessionsCount,
    workerCount,
}: {
    heading: string;
    jobCount: number;
    memoryCount: number;
    receipt: null | string;
    receiptTo?: null | string;
    sessionsCount: number;
    workerCount: number;
}) {
    const receiptClassName =
        'mx-auto mb-3 block w-fit max-w-full rounded-full border border-border bg-muted/50 px-3 py-1 text-center text-muted-foreground text-xs';

    return (
        <>
            {receipt && receiptTo ? (
                <Link
                    className={`${receiptClassName} transition-colors hover:border-border-strong hover:text-foreground`}
                    to={receiptTo}
                >
                    {receipt}
                </Link>
            ) : receipt ? (
                <p className={receiptClassName}>{receipt}</p>
            ) : null}
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
