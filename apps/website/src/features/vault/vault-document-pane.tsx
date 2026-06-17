import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Table, TableBody, TableCell, TableRow } from '../../components/ui/table.tsx';
import { useVaultBacklinks } from '../../hooks/vault/use-vault-backlinks.ts';
import type { VaultPageDetail } from './types.ts';
import { formatTimestamp } from './utils.ts';
import { type VaultLinkNavigate, VaultMarkdownViewer } from './vault-markdown-viewer.tsx';

export function VaultDocumentPane({
    isLoading,
    onNavigate,
    onSelectPage,
    page,
}: {
    isLoading: boolean;
    onNavigate?: VaultLinkNavigate;
    onSelectPage?: (page: { path: string }) => void;
    page: VaultPageDetail | null;
}) {
    if (!page) {
        return (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                    {isLoading ? 'Loading page...' : 'No Vault page selected.'}
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
                    <PageSignals page={page} />
                    <DocumentBody onNavigate={onNavigate} page={page} />
                    <BacklinksPanel onSelectPage={onSelectPage} page={page} />
                    <PageDetails page={page} />
                </div>
            </article>
        </div>
    );
}

function DocumentBody({
    onNavigate,
    page,
}: {
    onNavigate?: VaultLinkNavigate;
    page: VaultPageDetail;
}) {
    return (
        <div className="mt-1">
            <VaultMarkdownViewer onNavigate={onNavigate} value={page.body} />
        </div>
    );
}

const confidenceVariants = {
    high: 'success',
    low: 'warning',
    medium: 'info',
} as const;

function PageSignals({ page }: { page: VaultPageDetail }) {
    const confidence = readFrontmatterString(page.frontmatter.confidence);
    const volatility = readFrontmatterString(page.frontmatter.volatility);
    const verified = readFrontmatterString(page.frontmatter.verified);
    const tags = readFrontmatterList(page.frontmatter.tags);

    if (!(confidence || volatility || verified) && tags.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {confidence ? (
                <Badge
                    variant={
                        confidenceVariants[confidence as keyof typeof confidenceVariants] ??
                        'subtle'
                    }
                >
                    {`Confidence: ${confidence}`}
                </Badge>
            ) : null}
            {volatility ? <Badge variant="subtle">{`Volatility: ${volatility}`}</Badge> : null}
            {verified ? <Badge variant="subtle">{`Verified ${verified}`}</Badge> : null}
            {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                    {tag}
                </Badge>
            ))}
        </div>
    );
}

function BacklinksPanel({
    onSelectPage,
    page,
}: {
    onSelectPage?: (page: { path: string }) => void;
    page: VaultPageDetail;
}) {
    const backlinksQuery = useVaultBacklinks({ path: page.path });
    const links = backlinksQuery.data?.links ?? [];

    if (links.length === 0) {
        return null;
    }

    return (
        <div className="mt-12">
            <div className="-mx-3">
                <BadgeDivider>Backlinks</BadgeDivider>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
                {links.map((link) => (
                    <li key={link.fromPath}>
                        <button
                            className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/85"
                            onClick={() => onSelectPage?.({ path: link.fromPath })}
                            type="button"
                        >
                            {link.fromTitle}
                        </button>
                        <span className="ml-2 text-muted-foreground">{link.fromPath}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function readFrontmatterString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readFrontmatterList(value: unknown) {
    if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string');
    }
    return [];
}

function PageDetails({ page }: { page: VaultPageDetail }) {
    const rows = [
        ['Path', page.path],
        ['Updated', formatTimestamp(page.updatedAt)],
        ['Size', `${page.size.toLocaleString()} bytes`],
        ['Vault path', page.vaultPath],
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
