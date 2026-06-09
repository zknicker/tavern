import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import { CortexMarkdownViewer } from './cortex-markdown-viewer.tsx';
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

    const bodyOwnsTitle = /^#{1,6}\s+/u.test(page.body.trimStart());

    return (
        <div className="flex h-full min-h-0 flex-col">
            <article className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
                <div className="w-full">
                    {bodyOwnsTitle ? null : (
                        <h1 className="text-pretty font-semibold text-2xl tracking-tight">
                            {page.title}
                        </h1>
                    )}
                    <DocumentBody page={page} />
                    <PageDetails page={page} />
                </div>
            </article>
        </div>
    );
}

function DocumentBody({ page }: { page: CortexPageDetail }) {
    return (
        <div className="mt-1">
            <CortexMarkdownViewer value={page.body} />
        </div>
    );
}

function PageDetails({ page }: { page: CortexPageDetail }) {
    const rows = [
        ['Topic', page.topic],
        ['Path', page.path],
        ['Section', page.section],
        ['Updated', formatTimestamp(page.updatedAt)],
        ['Size', `${page.size.toLocaleString()} bytes`],
        ['Wiki path', page.wikiPath],
        ['Links', page.links.map((link) => link.target).join(', ') || 'None'],
    ];

    return (
        <div className="mt-12">
            <div className="-mx-3">
                <BadgeDivider>File Metadata</BadgeDivider>
            </div>
            <div className="-mx-3 mt-3">
                <Table className="table-fixed">
                    <TableBody className="[&_tr:last-child]:border-b-0">
                        {rows.map(([field, value]) => (
                            <TableRow key={field}>
                                <TableCell className="w-28 whitespace-nowrap text-muted-foreground">
                                    {field}
                                </TableCell>
                                <TableCell className="whitespace-normal break-words text-foreground leading-5">
                                    {value}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
