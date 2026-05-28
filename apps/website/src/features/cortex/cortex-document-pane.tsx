import { Badge } from '../../components/ui/badge.tsx';
import { Frame, FramePanel } from '../../components/ui/frame.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table.tsx';
import type { CortexPageDetail } from './types.ts';
import { formatTimestamp } from './utils.ts';

export function CortexDocumentPane({
    isLoading,
    page,
}: {
    isLoading: boolean;
    page: CortexPageDetail | null;
}) {
    if (!page) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                    {isLoading ? 'Loading page...' : 'No Cortex page selected.'}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <article className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
                <div className="w-full">
                    <h1 className="text-pretty font-semibold text-3xl tracking-tight">
                        {page.title}
                    </h1>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        <MetaPill>{page.type}</MetaPill>
                        <MetaPill>{page.status}</MetaPill>
                        {page.tags.map((tag) => (
                            <MetaPill key={tag}>#{tag}</MetaPill>
                        ))}
                    </div>
                    <DocumentBody value={page.body || page.compiledTruth} />
                    <CortexPageDatabase page={page} />
                </div>
            </article>
        </div>
    );
}

function MetaPill({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground text-xs">
            {children}
        </span>
    );
}

function DocumentBody({ value }: { value: string }) {
    return (
        <div className="mt-8 whitespace-pre-wrap break-words text-base text-foreground leading-7">
            {value || 'No body content.'}
        </div>
    );
}

function CortexPageDatabase({ page }: { page: CortexPageDetail }) {
    return (
        <div className="mt-12 space-y-8 border-t pt-8">
            <DatabaseSection
                emptyLabel="No claims extracted."
                title="Claims"
                value={`${page.claims.length} ${page.claims.length === 1 ? 'claim' : 'claims'}`}
            >
                {page.claims.length > 0 ? <ClaimsTable claims={page.claims} /> : null}
            </DatabaseSection>
            <DatabaseSection
                emptyLabel="No sources recorded."
                title="Sources"
                value={`${page.sourceRefs.length} ${
                    page.sourceRefs.length === 1 ? 'source' : 'sources'
                }`}
            >
                {page.sourceRefs.length > 0 ? <SourcesTable refs={page.sourceRefs} /> : null}
            </DatabaseSection>
            <DatabaseSection
                emptyLabel="No timeline entries."
                title="Timeline"
                value={`${page.timeline.length} ${page.timeline.length === 1 ? 'event' : 'events'}`}
            >
                {page.timeline.length > 0 ? <TimelineTable timeline={page.timeline} /> : null}
            </DatabaseSection>
            <DatabaseSection
                emptyLabel="No links recorded."
                title="Links"
                value={`${page.links.length} ${page.links.length === 1 ? 'link' : 'links'}`}
            >
                {page.links.length > 0 ? <LinksTable links={page.links} /> : null}
            </DatabaseSection>
            <DatabaseSection emptyLabel="No details recorded." title="Details" value={page.slug}>
                <DetailsTable page={page} />
            </DatabaseSection>
        </div>
    );
}

function DatabaseSection({
    children,
    emptyLabel,
    title,
    value,
}: {
    children: React.ReactNode;
    emptyLabel: string;
    title: string;
    value: string;
}) {
    return (
        <section className="space-y-3">
            <div className="flex items-baseline gap-2">
                <h2 className="font-medium text-base">{title}</h2>
                <span className="text-muted-foreground text-sm">{value}</span>
            </div>
            {children ?? <p className="text-muted-foreground text-sm">{emptyLabel}</p>}
        </section>
    );
}

function ClaimsTable({ claims }: { claims: CortexPageDetail['claims'] }) {
    return (
        <Frame className="w-full">
            <FramePanel className="gap-0 p-0">
                {claims.map((claim, index) => (
                    <div key={claim.id}>
                        {index > 0 ? <Separator /> : null}
                        <article className="p-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                                <h3 className="truncate font-medium text-sm">{claim.subject}</h3>
                                <Badge size="sm" variant={claimStatusVariant(claim.status)}>
                                    {claim.status}
                                </Badge>
                                <Badge size="sm" variant="subtle">
                                    {formatConfidence(claim.confidence)} confidence
                                </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-5">{claim.value}</p>
                        </article>
                    </div>
                ))}
            </FramePanel>
        </Frame>
    );
}

function SourcesTable({ refs }: { refs: CortexPageDetail['sourceRefs'] }) {
    return (
        <Frame className="w-full">
            <Table variant="card">
                <TableHeader>
                    <TableRow>
                        <TableHead>Kind</TableHead>
                        <TableHead>Locator</TableHead>
                        <TableHead>ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {refs.map((ref) => (
                        <TableRow key={ref.id}>
                            <TableCell className="font-medium">{ref.kind}</TableCell>
                            <TableCell className="whitespace-normal leading-5">
                                {ref.locator ?? 'None'}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground text-xs">
                                {ref.id}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Frame>
    );
}

function TimelineTable({ timeline }: { timeline: CortexPageDetail['timeline'] }) {
    return (
        <Frame className="w-full">
            <Table variant="card">
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Source</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {timeline.map((entry) => (
                        <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                                {formatTimestamp(entry.createdAt)}
                            </TableCell>
                            <TableCell className="whitespace-normal leading-5">
                                {entry.body}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatSourceRefs(entry.sourceRefs)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Frame>
    );
}

function LinksTable({ links }: { links: CortexPageDetail['links'] }) {
    return (
        <Frame className="w-full">
            <Table variant="card">
                <TableHeader>
                    <TableRow>
                        <TableHead>Target</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {links.map((link) => (
                        <TableRow key={link.id}>
                            <TableCell className="font-medium">{link.targetSlug}</TableCell>
                            <TableCell>{link.linkKind}</TableCell>
                            <TableCell>{link.label ?? 'None'}</TableCell>
                            <TableCell>{link.targetPageId ? 'Resolved' : 'Unresolved'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Frame>
    );
}

function DetailsTable({ page }: { page: CortexPageDetail }) {
    return (
        <Frame className="w-full">
            <Table variant="card">
                <TableHeader>
                    <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[
                        ['Slug', page.slug],
                        ['Type', page.type],
                        ['Status', page.status],
                        ['Aliases', page.aliases.join(', ') || 'None'],
                        ['Created', formatTimestamp(page.createdAt)],
                        ['Updated', formatTimestamp(page.updatedAt)],
                        [
                            'Embeddings',
                            `${page.indexing.currentEmbeddingCount}/${page.indexing.chunkCount} current`,
                        ],
                        [
                            'Last indexed',
                            page.indexing.lastEmbeddedAt
                                ? formatTimestamp(page.indexing.lastEmbeddedAt)
                                : 'Not yet',
                        ],
                    ].map(([label, value]) => (
                        <TableRow key={label}>
                            <TableCell className="font-medium text-muted-foreground">
                                {label}
                            </TableCell>
                            <TableCell className="whitespace-normal leading-5">{value}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Frame>
    );
}

function formatConfidence(value: number | null) {
    return value === null ? 'None' : `${Math.round(value * 100)}%`;
}

function claimStatusVariant(status: string) {
    return status === 'active' ? 'success' : 'secondary';
}

function formatSourceRefs(refs: CortexPageDetail['sourceRefs']) {
    if (refs.length === 0) {
        return 'None';
    }
    return refs.map((ref) => ref.kind).join(', ');
}
