import { Link } from 'react-router-dom';
import { Skeleton } from '../../../components/ui/skeleton.tsx';
import { useMemoryJobDetail } from '../../../hooks/memory/use-memory-history.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import { formatShortTime } from '../../../lib/format.ts';
import {
    type MemoryJobDetailView,
    memoryDreamSummary,
    memoryFileChangeLabel,
    memoryJobDetailLine,
    memoryJobObservations,
} from './memory-job-copy.ts';

export function MemoryJobExpandedDetail({ jobId }: { jobId: string }) {
    const jobQuery = useMemoryJobDetail(jobId);

    if (jobQuery.isPending) {
        return <Skeleton className="mx-4 mb-4 h-16 rounded-md" />;
    }
    if (jobQuery.error) {
        return <div className="px-4 pb-4 text-destructive text-sm">{jobQuery.error.message}</div>;
    }
    return jobQuery.data ? <MemoryJobDetailBody job={jobQuery.data} /> : null;
}

export function MemoryJobDetailBody({ job }: { job: MemoryJobDetailView }) {
    const observations = memoryJobObservations(job);
    const summary = memoryDreamSummary(job);

    return (
        <div className="space-y-3 px-4 pt-3.5 pb-4">
            <p className="text-meta text-muted-foreground">
                {formatShortTime(job.completedAt ?? job.createdAt)}
                {job.chatId ? (
                    <>
                        {' · '}
                        <Link className="hover:underline" to={appRoutes.chat(job.chatId)}>
                            Open chat
                        </Link>
                    </>
                ) : null}
            </p>

            {job.status === 'failed' && job.error ? (
                <div className="text-destructive text-sm">{job.error}</div>
            ) : null}

            {job.status === 'skipped' ? (
                <p className="text-muted-foreground text-sm">{memoryJobDetailLine(job)}</p>
            ) : null}

            {observations ? (
                <DetailBlock label="Saved to memory">
                    <p className="whitespace-pre-wrap text-sm">{observations}</p>
                </DetailBlock>
            ) : null}

            {summary ? (
                <DetailBlock label="Summary">
                    <p className="whitespace-pre-wrap text-sm">{summary}</p>
                </DetailBlock>
            ) : null}

            {job.fileChanges.length > 0 ? (
                <DetailBlock label="Files updated">
                    <ul className="space-y-1 text-sm">
                        {job.fileChanges.map((change) => (
                            <li className="truncate" key={`${change.path}-${change.afterHash}`}>
                                {memoryFileChangeLabel(change)}
                            </li>
                        ))}
                    </ul>
                </DetailBlock>
            ) : null}
        </div>
    );
}

function DetailBlock({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="rounded-lg border border-border/70 px-3.5 py-3">
            <p className="mb-1.5 text-meta text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}
