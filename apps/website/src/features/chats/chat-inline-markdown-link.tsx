import type * as React from 'react';

export function MarkdownLink({ children, href }: { children: React.ReactNode; href: string }) {
    return (
        <a
            className="text-primary underline underline-offset-2 hover:text-primary/85"
            href={href}
            rel="noreferrer"
            target="_blank"
        >
            {children}
        </a>
    );
}

export function matchMarkdownLink(text: string, cursor: number) {
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

export function matchBareUrl(text: string) {
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
