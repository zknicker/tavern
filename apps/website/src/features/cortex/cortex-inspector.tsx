import type { CortexPageDetail } from './types.ts';
import { formatTimestamp } from './utils.ts';

export function CortexInspector({ page }: { page: CortexPageDetail | null }) {
    return (
        <aside className="hidden min-h-0 overflow-auto px-5 pt-4 pb-6 lg:block">
            <div className="rounded-xl border bg-background/96 shadow-black/5 shadow-lg">
                <CortexPageDetailPanel page={page} />
            </div>
        </aside>
    );
}

function CortexPageDetailPanel({ page }: { page: CortexPageDetail | null }) {
    if (!page) {
        return <div className="p-4 text-muted-foreground text-sm">No page selected.</div>;
    }

    return (
        <div className="space-y-5 p-4">
            <DetailSection title="Memory">
                <HealthRows page={page} />
            </DetailSection>

            <DetailSection title="Provenance">
                <MetadataGrid
                    rows={[
                        ['Sources', pluralize(page.sourceRefs.length, 'source')],
                        ['Timeline', pluralize(page.timeline.length, 'event')],
                        ['Claims', pluralize(page.claims.length, 'claim')],
                        ['Links', pluralize(page.links.length, 'link')],
                    ]}
                />
                {page.timeline[0] ? (
                    <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2">
                        <div className="text-muted-foreground text-xs">
                            Latest: {formatTimestamp(page.timeline.at(-1)?.createdAt ?? '')}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm">
                            {page.timeline.at(-1)?.body}
                        </div>
                    </div>
                ) : null}
            </DetailSection>

            <DetailSection title="Details">
                <MetadataGrid
                    rows={[
                        ['Type', page.type],
                        ['Status', page.status],
                        ['Aliases', page.aliases.join(', ') || 'None'],
                        ['Updated', formatTimestamp(page.updatedAt)],
                        ['Created', formatTimestamp(page.createdAt)],
                        ['Slug', page.slug],
                    ]}
                />
            </DetailSection>

            {page.links.length > 0 ? (
                <DetailSection title="Links">
                    <div className="space-y-2">
                        {page.links.map((link) => (
                            <div
                                className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
                                key={link.id}
                            >
                                <div className="font-medium">{link.label ?? link.targetSlug}</div>
                                <div className="mt-1 text-muted-foreground text-xs">
                                    {link.linkKind} {'->'} {link.targetSlug}
                                </div>
                            </div>
                        ))}
                    </div>
                </DetailSection>
            ) : null}

            <SourceSummary refs={page.sourceRefs} />
        </div>
    );
}

function HealthRows({ page }: { page: CortexPageDetail }) {
    const { indexing } = page;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="font-medium text-sm">Search index</div>
                    <div className="text-muted-foreground text-xs">
                        {indexing.currentEmbeddingCount} of {indexing.chunkCount} chunks embedded
                    </div>
                </div>
                <StatusPill status={indexing.status} />
            </div>
            <MetadataGrid
                rows={[
                    [
                        'Embeddings',
                        indexing.status === 'ready'
                            ? 'Current'
                            : `${indexing.missingEmbeddingCount} missing, ${indexing.staleEmbeddingCount} stale`,
                    ],
                    ['Model', indexing.embeddingModel],
                    [
                        'Last indexed',
                        indexing.lastEmbeddedAt
                            ? formatTimestamp(indexing.lastEmbeddedAt)
                            : 'Not yet',
                    ],
                ]}
            />
        </div>
    );
}

function StatusPill({ status }: { status: CortexPageDetail['indexing']['status'] }) {
    const label =
        status === 'ready'
            ? 'Ready'
            : status === 'needs-indexing'
              ? 'Needs indexing'
              : 'Not indexed';
    return (
        <span className="shrink-0 rounded-full border bg-muted/20 px-2 py-1 text-muted-foreground text-xs">
            {label}
        </span>
    );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section>
            <h3 className="mb-2 font-medium text-sm">{title}</h3>
            {children}
        </section>
    );
}

function MetadataGrid({ rows }: { rows: [string, string][] }) {
    return (
        <dl className="grid gap-2 text-sm">
            {rows.map(([label, value]) => (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3" key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function SourceSummary({ refs }: { refs: CortexPageDetail['sourceRefs'] }) {
    if (refs.length === 0) {
        return null;
    }

    return (
        <DetailSection title="Captured From">
            <div className="flex flex-wrap gap-2">
                {Array.from(new Set(refs.map((ref) => ref.kind))).map((kind) => (
                    <span
                        className="rounded-full border bg-muted/20 px-2 py-1 text-muted-foreground text-xs"
                        key={kind}
                    >
                        {kind}
                    </span>
                ))}
            </div>
        </DetailSection>
    );
}

function pluralize(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
