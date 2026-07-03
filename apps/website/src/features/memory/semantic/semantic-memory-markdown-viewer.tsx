import type * as React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../../components/ui/table.tsx';
import { type MarkdownBlock, parseMarkdownBlocks } from './semantic-memory-markdown-parser.ts';

export type SemanticMemoryLinkNavigate = (target: string) => void;

export function SemanticMemoryMarkdownViewer({
    onNavigate,
    value,
}: {
    onNavigate?: SemanticMemoryLinkNavigate;
    value: string;
}) {
    const blocks = parseMarkdownBlocks(value);

    if (blocks.length === 0) {
        return (
            <div className="grid min-h-24 place-items-center text-muted-foreground text-sm">
                No body content.
            </div>
        );
    }

    return (
        <div className="text-foreground text-sm leading-7">
            {blocks.map((block) => (
                <MarkdownBlockContent
                    block={block}
                    key={`${block.kind}:${block.startLine}`}
                    onNavigate={onNavigate}
                />
            ))}
        </div>
    );
}

function MarkdownBlockContent({
    block,
    onNavigate,
}: {
    block: MarkdownBlock;
    onNavigate?: SemanticMemoryLinkNavigate;
}) {
    switch (block.kind) {
        case 'blockquote':
            return (
                <blockquote className="my-4 border-border border-l-2 py-0.5 pl-3 text-muted-foreground">
                    {block.lines.map((line) => (
                        <p key={`${block.startLine}:quote:${line}`}>
                            {renderInlineMarkdown(
                                line,
                                `${block.startLine}:quote:${line}`,
                                onNavigate
                            )}
                        </p>
                    ))}
                </blockquote>
            );
        case 'code':
            return (
                <pre className="my-4 overflow-x-auto rounded-lg bg-muted/50 px-3 py-2 font-mono text-code leading-6">
                    <code>{block.code}</code>
                </pre>
            );
        case 'heading':
            return <MarkdownHeading block={block} onNavigate={onNavigate} />;
        case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
                <List className="my-3 list-outside space-y-1.5 pl-5 marker:text-muted-foreground">
                    {block.items.map((item) => (
                        <li key={`${block.startLine}:item:${item}`}>
                            {renderInlineMarkdown(
                                item,
                                `${block.startLine}:item:${item}`,
                                onNavigate
                            )}
                        </li>
                    ))}
                </List>
            );
        }
        case 'paragraph':
            return (
                <p className="my-3 whitespace-pre-wrap">
                    {renderInlineMarkdown(
                        block.lines.join('\n'),
                        `${block.startLine}:paragraph`,
                        onNavigate
                    )}
                </p>
            );
        case 'table':
            return <MarkdownTable block={block} onNavigate={onNavigate} />;
    }
}

function MarkdownHeading({
    block,
    onNavigate,
}: {
    block: Extract<MarkdownBlock, { kind: 'heading' }>;
    onNavigate?: SemanticMemoryLinkNavigate;
}) {
    const content = renderInlineMarkdown(block.text, `${block.startLine}:heading`, onNavigate);

    if (block.depth === 1) {
        return (
            <h1 className="mt-0 mb-3 font-semibold text-2xl leading-tight tracking-tight">
                {content}
            </h1>
        );
    }

    if (block.depth === 2) {
        return (
            <h2 className="mt-7 mb-2 font-semibold text-lg leading-tight first:mt-0">{content}</h2>
        );
    }

    return <h3 className="mt-6 mb-2 font-medium text-base leading-snug first:mt-0">{content}</h3>;
}

function MarkdownTable({
    block,
    onNavigate,
}: {
    block: Extract<MarkdownBlock, { kind: 'table' }>;
    onNavigate?: SemanticMemoryLinkNavigate;
}) {
    const [header, ...rows] = block.rows;

    return (
        <div className="my-4 overflow-hidden rounded-lg border border-border/70">
            <Table className="table-auto">
                {header ? (
                    <TableHeader>
                        <TableRow className="bg-muted/25">
                            {header.map((cell) => (
                                <TableHead
                                    className="h-auto whitespace-normal px-3 py-2 leading-5"
                                    key={`${block.startLine}:h:${cell}`}
                                >
                                    {renderInlineMarkdown(
                                        cell,
                                        `${block.startLine}:h:${cell}`,
                                        onNavigate
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                ) : null}
                <TableBody className="[&_tr:last-child]:border-b-0">
                    {rows.map((row) => (
                        <TableRow key={`${block.startLine}:r:${row.join('|')}`}>
                            {row.map((cell) => (
                                <TableCell
                                    className="whitespace-normal px-3 py-2 align-top leading-5"
                                    key={`${block.startLine}:c:${row.join('|')}:${cell}`}
                                >
                                    {renderInlineMarkdown(
                                        cell,
                                        `${block.startLine}:c:${row.join('|')}:${cell}`,
                                        onNavigate
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function renderInlineMarkdown(
    text: string,
    keyPrefix: string,
    onNavigate?: SemanticMemoryLinkNavigate
): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const match =
            matchInlineCode(text, cursor) ??
            matchMarkdownLink(text, cursor) ??
            matchMemoryLink(text, cursor) ??
            matchDelimited(text, cursor, '**') ??
            matchDelimited(text, cursor, '__') ??
            matchDelimited(text, cursor, '*');

        if (!match) {
            nodes.push(text[cursor]);
            cursor += 1;
            continue;
        }

        nodes.push(renderInlineMatch(match, `${keyPrefix}:${cursor}`, onNavigate));
        cursor = match.end;
    }

    return nodes;
}

type InlineMatch =
    | { code: string; end: number; kind: 'code' }
    | { content: string; end: number; kind: 'emphasis' | 'strong' }
    | { end: number; href: string; kind: 'link'; label: string }
    | { end: number; kind: 'memoryLink'; label: string; target: string };

function renderInlineMatch(
    match: InlineMatch,
    key: string,
    onNavigate?: SemanticMemoryLinkNavigate
) {
    switch (match.kind) {
        case 'code':
            return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]" key={key}>
                    {match.code}
                </code>
            );
        case 'emphasis':
            return (
                <em key={key}>{renderInlineMarkdown(match.content, `${key}:em`, onNavigate)}</em>
            );
        case 'link': {
            if (onNavigate && isMemoryPageHref(match.href)) {
                const href = match.href;
                return (
                    <PageLink key={key} onNavigate={() => onNavigate(href)}>
                        {renderInlineMarkdown(match.label, `${key}:link`)}
                    </PageLink>
                );
            }
            return (
                <a
                    className="text-primary underline underline-offset-2 hover:text-primary/85"
                    href={match.href}
                    key={key}
                    rel="noreferrer"
                    target="_blank"
                >
                    {renderInlineMarkdown(match.label, `${key}:link`, onNavigate)}
                </a>
            );
        }
        case 'strong':
            return (
                <strong className="font-semibold" key={key}>
                    {renderInlineMarkdown(match.content, `${key}:strong`, onNavigate)}
                </strong>
            );
        case 'memoryLink': {
            if (onNavigate) {
                const target = match.target;
                return (
                    <PageLink key={key} onNavigate={() => onNavigate(target)}>
                        {match.label}
                    </PageLink>
                );
            }
            return (
                <span className="rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]" key={key}>
                    {match.label}
                </span>
            );
        }
    }
}

function PageLink({ children, onNavigate }: { children: React.ReactNode; onNavigate: () => void }) {
    return (
        <button
            className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/85"
            onClick={onNavigate}
            type="button"
        >
            {children}
        </button>
    );
}

function isMemoryPageHref(href: string) {
    return href.endsWith('.md') && !/^[a-z][a-z0-9+.-]*:/iu.test(href) && !href.startsWith('/');
}

function matchInlineCode(text: string, cursor: number): InlineMatch | null {
    if (text[cursor] !== '`') {
        return null;
    }
    const end = text.indexOf('`', cursor + 1);
    return end > cursor + 1
        ? { code: text.slice(cursor + 1, end), end: end + 1, kind: 'code' }
        : null;
}

function matchMarkdownLink(text: string, cursor: number): InlineMatch | null {
    if (text[cursor] !== '[') {
        return null;
    }

    const labelEnd = text.indexOf(']', cursor + 1);
    if (labelEnd <= cursor + 1 || text[labelEnd + 1] !== '(') {
        return null;
    }

    const hrefEnd = text.indexOf(')', labelEnd + 2);
    const href = sanitizeHref(text.slice(labelEnd + 2, hrefEnd).trim());
    if (hrefEnd <= labelEnd + 2 || !href) {
        return null;
    }

    return {
        end: hrefEnd + 1,
        href,
        kind: 'link',
        label: text.slice(cursor + 1, labelEnd),
    };
}

function matchMemoryLink(text: string, cursor: number): InlineMatch | null {
    if (!text.startsWith('[[', cursor)) {
        return null;
    }

    const end = text.indexOf(']]', cursor + 2);
    if (end <= cursor + 2) {
        return null;
    }

    const raw = text.slice(cursor + 2, end);
    return {
        end: end + 2,
        kind: 'memoryLink',
        label: raw.split('|').at(-1)?.trim() || raw,
        target: raw.split('|')[0]?.split('#')[0]?.trim() || raw,
    };
}

function matchDelimited(
    text: string,
    cursor: number,
    delimiter: '*' | '**' | '__'
): InlineMatch | null {
    if (!text.startsWith(delimiter, cursor)) {
        return null;
    }
    const contentStart = cursor + delimiter.length;
    const contentEnd = text.indexOf(delimiter, contentStart);
    if (contentEnd <= contentStart) {
        return null;
    }
    return {
        content: text.slice(contentStart, contentEnd),
        end: contentEnd + delimiter.length,
        kind: delimiter.length === 1 ? 'emphasis' : 'strong',
    };
}

function sanitizeHref(value: string) {
    if (/^\s*(?:javascript|data):/iu.test(value)) {
        return null;
    }
    return value;
}
