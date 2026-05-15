import type { SessionHistoryArtifactRowOutput } from '../../../../lib/trpc.tsx';

export function ArtifactLogEntry({ entry }: { entry: SessionHistoryArtifactRowOutput }) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-[color:var(--success-border)] bg-[var(--success-bg)] px-3 py-1.5">
            <span className="size-1 shrink-0 rounded-full bg-success" />
            <span className="font-medium text-success text-xs uppercase tracking-[0.16em]">
                {entry.artifact.artifactType}
            </span>
            <span className="min-w-0 truncate text-foreground/90 text-sm">
                {entry.artifact.path ?? 'Stored artifact'}
            </span>
        </div>
    );
}
