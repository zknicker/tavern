import type * as React from 'react';
import { MentionChip } from '../mentions/mention-chip.tsx';
import type { Mention } from '../mentions/mention-types.ts';
import { splitMentionText } from '../mentions/render-mention-text.tsx';

const maxParseDepth = 6;

export function ChatInlineMarkdownText({
    content,
    mentions,
}: {
    content: string;
    mentions?: readonly Mention[];
}) {
    if (!mentions || mentions.length === 0) {
        return renderInlineMarkdown(content, 'message');
    }

    return splitMentionText(content, mentions).flatMap((fragment, index) => {
        if (fragment.type === 'mention') {
            return (
                <MentionChip
                    id={fragment.mention.id}
                    key={`mention:${fragment.mention.start}:${fragment.mention.end}`}
                    kind={fragment.mention.kind}
                    label={fragment.mention.label}
                    metadata={fragment.mention.metadata}
                />
            );
        }

        return renderInlineMarkdown(fragment.text, `text:${fragment.start}:${index}`);
    });
}

function renderInlineMarkdown(text: string, keyPrefix: string, depth = 0): React.ReactNode[] {
    if (text.length === 0) {
        return [];
    }

    if (depth > maxParseDepth) {
        return [text];
    }

    const nodes: React.ReactNode[] = [];
    let buffer = '';
    let cursor = 0;

    const flushBuffer = () => {
        if (buffer.length === 0) {
            return;
        }

        nodes.push(buffer);
        buffer = '';
    };

    while (cursor < text.length) {
        const urlMatch = matchBareUrl(text.slice(cursor));

        if (urlMatch) {
            flushBuffer();
            nodes.push(
                <MarkdownLink href={urlMatch.href} key={`${keyPrefix}:url:${cursor}`}>
                    {urlMatch.label}
                </MarkdownLink>
            );
            cursor += urlMatch.length;
            continue;
        }

        if (text[cursor] === '`') {
            const end = text.indexOf('`', cursor + 1);

            if (end > cursor + 1) {
                flushBuffer();
                nodes.push(
                    <code
                        className="break-words rounded bg-muted px-1 py-0.5 font-mono text-[0.92em] [overflow-wrap:anywhere]"
                        key={`${keyPrefix}:code:${cursor}`}
                    >
                        {text.slice(cursor + 1, end)}
                    </code>
                );
                cursor = end + 1;
                continue;
            }
        }

        const link = matchMarkdownLink(text, cursor);

        if (link) {
            flushBuffer();
            nodes.push(
                <MarkdownLink href={link.href} key={`${keyPrefix}:link:${cursor}`}>
                    {renderInlineMarkdown(
                        link.label,
                        `${keyPrefix}:link-label:${cursor}`,
                        depth + 1
                    )}
                </MarkdownLink>
            );
            cursor = link.end;
            continue;
        }

        const strong = matchDelimited(text, cursor, '**') ?? matchDelimited(text, cursor, '__');

        if (strong) {
            flushBuffer();
            nodes.push(
                <strong className="font-semibold" key={`${keyPrefix}:strong:${cursor}`}>
                    {renderInlineMarkdown(
                        strong.content,
                        `${keyPrefix}:strong:${cursor}`,
                        depth + 1
                    )}
                </strong>
            );
            cursor = strong.end;
            continue;
        }

        const emphasis = matchDelimited(text, cursor, '*');

        if (emphasis) {
            flushBuffer();
            nodes.push(
                <em className="italic" key={`${keyPrefix}:em:${cursor}`}>
                    {renderInlineMarkdown(emphasis.content, `${keyPrefix}:em:${cursor}`, depth + 1)}
                </em>
            );
            cursor = emphasis.end;
            continue;
        }

        buffer += text[cursor];
        cursor += 1;
    }

    flushBuffer();
    return nodes;
}

function MarkdownLink({ children, href }: { children: React.ReactNode; href: string }) {
    return (
        <a
            className="break-words text-primary underline underline-offset-2 [overflow-wrap:anywhere] hover:text-primary/85"
            href={href}
            rel="noreferrer"
            target="_blank"
        >
            {children}
        </a>
    );
}

function matchDelimited(text: string, cursor: number, delimiter: '*' | '**' | '__') {
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
    };
}

function matchMarkdownLink(text: string, cursor: number) {
    if (text[cursor] !== '[') {
        return null;
    }

    const labelEnd = text.indexOf(']', cursor + 1);

    if (labelEnd <= cursor + 1 || text[labelEnd + 1] !== '(') {
        return null;
    }

    const hrefEnd = text.indexOf(')', labelEnd + 2);

    if (hrefEnd <= labelEnd + 2) {
        return null;
    }

    const href = sanitizeUrl(text.slice(labelEnd + 2, hrefEnd).trim());

    if (!href) {
        return null;
    }

    return {
        end: hrefEnd + 1,
        href,
        label: text.slice(cursor + 1, labelEnd),
    };
}

function matchBareUrl(text: string) {
    const match = /^(?:https?:\/\/|www\.)[^\s<>()]+/u.exec(text);

    if (!match) {
        return null;
    }

    const raw = match[0];
    const label = stripTrailingUrlPunctuation(raw);
    const href = sanitizeUrl(label);

    if (!href) {
        return null;
    }

    return {
        href,
        label,
        length: label.length,
    };
}

function sanitizeUrl(value: string) {
    const href = value.startsWith('www.') ? `https://${value}` : value;

    try {
        const url = new URL(href);
        return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}

function stripTrailingUrlPunctuation(value: string) {
    let end = value.length;

    while (end > 0 && /[.,;:!?]/u.test(value[end - 1] ?? '')) {
        end -= 1;
    }

    return value.slice(0, end);
}
