import type React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { useVaultBacklinks } from '../../hooks/vault/use-vault-backlinks.ts';
import { cn } from '../../lib/utils.ts';
import type { VaultPageDetail } from './types.ts';
import { formatTimestamp } from './utils.ts';

export function VaultDocumentInspector({
    onSelectPage,
    page,
}: {
    onSelectPage?: (page: { path: string }) => void;
    page: VaultPageDetail;
}) {
    const tags = readFrontmatterList(page.frontmatter.tags);
    const properties = [
        ['Kanban plugin', readFrontmatterString(page.frontmatter['kanban-plugin']) ?? ''],
        ['Aliases', readFrontmatterList(page.frontmatter.aliases).join(', ')],
        ['CSS classes', readFrontmatterList(page.frontmatter.cssclasses).join(', ')],
        ['Tags', tags.join(', ')],
    ] as const;
    const fileRows = [
        ['Path', page.path],
        ['Updated', formatTimestamp(page.updatedAt)],
        ['Size', `${page.size.toLocaleString()} bytes`],
        ['Vault path', page.vaultPath],
        ['Links', page.links.map((link) => link.target).join(', ') || 'None'],
    ] as const;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-4">
                <InspectorSection title="Properties">
                    <InspectorDescriptionList>
                        {properties.map(([label, value]) => (
                            <InspectorValueRow
                                key={label}
                                label={label}
                                value={value || 'None'}
                                valueMuted={!value}
                            />
                        ))}
                    </InspectorDescriptionList>
                    <PageSignals page={page} />
                </InspectorSection>
                <BacklinksPanel onSelectPage={onSelectPage} page={page} />
                <InspectorSection title="File Metadata">
                    <InspectorDescriptionList>
                        {fileRows.map(([label, value]) => (
                            <InspectorValueRow key={label} label={label} value={value} />
                        ))}
                    </InspectorDescriptionList>
                </InspectorSection>
            </div>
        </div>
    );
}

function InspectorSection({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="space-y-3">
            <BadgeDivider>{title}</BadgeDivider>
            {children}
        </section>
    );
}

function InspectorDescriptionList({ children }: { children: React.ReactNode }) {
    return <dl className="space-y-2.5">{children}</dl>;
}

function InspectorValueRow({
    label,
    value,
    valueMuted = false,
}: {
    label: string;
    value: string;
    valueMuted?: boolean;
}) {
    return (
        <div className="grid grid-cols-[7.25rem_minmax(0,1fr)] items-baseline gap-3 text-sm">
            <dt className="min-w-0 truncate font-medium text-foreground/80">{label}</dt>
            <dd
                className={cn(
                    'min-w-0 break-words text-right',
                    valueMuted ? 'text-muted-foreground' : 'text-foreground/90'
                )}
            >
                {value}
            </dd>
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
        <div className="flex flex-wrap items-center gap-1.5">
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

    return (
        <InspectorSection title="Backlinks">
            {links.length === 0 ? (
                <p className="text-muted-foreground text-sm">No backlinks</p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {links.map((link) => (
                        <li key={link.fromPath}>
                            <button
                                className="max-w-full cursor-pointer truncate text-primary underline underline-offset-2 hover:text-primary/85"
                                onClick={() => onSelectPage?.({ path: link.fromPath })}
                                type="button"
                            >
                                {link.fromTitle}
                            </button>
                            <div className="truncate text-muted-foreground text-xs">
                                {link.fromPath}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </InspectorSection>
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
