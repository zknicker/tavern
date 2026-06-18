import { Link02Icon, Tag01Icon, TextAlignLeftIcon } from '@hugeicons-pro/core-stroke-rounded';
import type React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { useVaultBacklinks } from '../../hooks/vault/use-vault-backlinks.ts';
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
        ['kanban-plugin', readFrontmatterString(page.frontmatter['kanban-plugin']) ?? ''],
        ['aliases', readFrontmatterList(page.frontmatter.aliases).join(', ')],
        ['cssclasses', readFrontmatterList(page.frontmatter.cssclasses).join(', ')],
        ['tags', tags.join(', ')],
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
            <div className="flex h-10 shrink-0 items-center gap-1 border-border/70 border-b px-2">
                <InspectorTab active icon={Tag01Icon} label="Properties" />
                <InspectorTab icon={Link02Icon} label="Backlinks" />
                <InspectorTab icon={TextAlignLeftIcon} label="File" />
            </div>
            <div className="min-h-0 flex-1 space-y-6 overflow-auto px-4 py-4">
                <InspectorSection title="Properties">
                    <div className="space-y-2">
                        {properties.map(([label, value]) => (
                            <InspectorValueRow
                                key={label}
                                label={label}
                                value={value || '0'}
                                valueMuted={!value}
                            />
                        ))}
                    </div>
                    <PageSignals page={page} />
                </InspectorSection>
                <BacklinksPanel onSelectPage={onSelectPage} page={page} />
                <InspectorSection title="File Metadata">
                    <div className="space-y-2">
                        {fileRows.map(([label, value]) => (
                            <InspectorValueRow key={label} label={label} value={value} />
                        ))}
                    </div>
                </InspectorSection>
            </div>
        </div>
    );
}

function InspectorTab({
    active = false,
    icon,
    label,
}: {
    active?: boolean;
    icon: typeof Tag01Icon;
    label: string;
}) {
    return (
        <button
            aria-label={label}
            className={
                active
                    ? 'flex size-7 cursor-default items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'flex size-7 cursor-default items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }
            type="button"
        >
            <Icon className="size-4" icon={icon} />
        </button>
    );
}

function InspectorSection({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="space-y-3">
            <BadgeDivider labelClassName="text-xs" separatorClassName="min-w-3">
                {title}
            </BadgeDivider>
            {children}
        </section>
    );
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
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3 text-sm">
            <div className="min-w-0 truncate text-muted-foreground">{label}</div>
            <div className={valueMuted ? 'text-muted-foreground' : 'min-w-0 break-words'}>
                {value}
            </div>
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
                <div className="text-muted-foreground text-sm">0</div>
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
