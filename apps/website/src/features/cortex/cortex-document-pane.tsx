import type { ReactNode } from 'react';
import { Frame } from '../../components/ui/frame.tsx';
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
                    {isLoading ? 'Loading page...' : 'No wiki page selected.'}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <article className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
                <div className="w-full">
                    <h1 className="text-pretty font-semibold text-2xl tracking-tight">
                        {page.title}
                    </h1>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        <MetaPill>{page.topic}</MetaPill>
                        <MetaPill>{page.section}</MetaPill>
                        {page.archived ? <MetaPill>archived</MetaPill> : null}
                    </div>
                    <DocumentBody value={page.body} />
                    <PageDetails page={page} />
                </div>
            </article>
        </div>
    );
}

function MetaPill({ children }: { children: ReactNode }) {
    return (
        <span className="rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground text-xs">
            {children}
        </span>
    );
}

function DocumentBody({ value }: { value: string }) {
    return (
        <div className="mt-8 whitespace-pre-wrap break-words text-foreground text-sm leading-6">
            {value || 'No body content.'}
        </div>
    );
}

function PageDetails({ page }: { page: CortexPageDetail }) {
    return (
        <div className="mt-12 border-t pt-8">
            <h2 className="font-medium text-base">File</h2>
            <Frame className="mt-3 w-full">
                <Table variant="card">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[
                            ['Topic', page.topic],
                            ['Path', page.path],
                            ['Section', page.section],
                            ['Updated', formatTimestamp(page.updatedAt)],
                            ['Size', `${page.size.toLocaleString()} bytes`],
                            ['Wiki path', page.wikiPath],
                            ['Links', page.links.map((link) => link.target).join(', ') || 'None'],
                        ].map(([field, value]) => (
                            <TableRow key={field}>
                                <TableCell className="font-medium">{field}</TableCell>
                                <TableCell className="whitespace-normal break-words leading-5">
                                    {value}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Frame>
        </div>
    );
}
