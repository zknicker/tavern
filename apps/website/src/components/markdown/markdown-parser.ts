export type MarkdownBlock =
    | { kind: 'blockquote'; lines: string[]; startLine: number }
    | { kind: 'code'; code: string; language: string | null; startLine: number }
    | { kind: 'heading'; depth: number; startLine: number; text: string }
    | { kind: 'list'; items: string[]; ordered: boolean; startLine: number }
    | { kind: 'paragraph'; lines: string[]; startLine: number }
    | { kind: 'table'; rows: string[][]; startLine: number };

export function parseMarkdownBlocks(value: string): MarkdownBlock[] {
    const lines = value.split('\n');
    const blocks: MarkdownBlock[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index] ?? '';
        const startLine = index + 1;

        if (!line.trim()) {
            index += 1;
            continue;
        }

        const fence = /^```(\S*)\s*$/u.exec(line);
        if (fence) {
            const codeLines: string[] = [];
            index += 1;
            while (index < lines.length && !/^```\s*$/u.test(lines[index] ?? '')) {
                codeLines.push(lines[index] ?? '');
                index += 1;
            }
            index += index < lines.length ? 1 : 0;
            blocks.push({
                code: codeLines.join('\n'),
                kind: 'code',
                language: fence[1] || null,
                startLine,
            });
            continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
        if (heading) {
            blocks.push({
                depth: heading[1]?.length ?? 1,
                kind: 'heading',
                startLine,
                text: heading[2] ?? '',
            });
            index += 1;
            continue;
        }

        if (isTableStart(lines, index)) {
            const tableLines: string[] = [line];
            index += 2;
            while (index < lines.length && isTableRow(lines[index] ?? '')) {
                tableLines.push(lines[index] ?? '');
                index += 1;
            }
            blocks.push({
                kind: 'table',
                rows: tableLines.map(splitTableRow),
                startLine,
            });
            continue;
        }

        const listMatch = matchListItem(line);
        if (listMatch) {
            const items = [listMatch.text];
            index += 1;
            while (index < lines.length) {
                const next = matchListItem(lines[index] ?? '');
                if (!next || next.ordered !== listMatch.ordered) {
                    break;
                }
                items.push(next.text);
                index += 1;
            }
            blocks.push({ items, kind: 'list', ordered: listMatch.ordered, startLine });
            continue;
        }

        if (/^\s*>\s?/u.test(line)) {
            const quoteLines = [line.replace(/^\s*>\s?/u, '')];
            index += 1;
            while (index < lines.length && /^\s*>\s?/u.test(lines[index] ?? '')) {
                quoteLines.push((lines[index] ?? '').replace(/^\s*>\s?/u, ''));
                index += 1;
            }
            blocks.push({ kind: 'blockquote', lines: quoteLines, startLine });
            continue;
        }

        const paragraphLines = [line];
        index += 1;
        while (index < lines.length && shouldContinueParagraph(lines, index)) {
            paragraphLines.push(lines[index] ?? '');
            index += 1;
        }
        blocks.push({ kind: 'paragraph', lines: paragraphLines, startLine });
    }

    return blocks;
}

function shouldContinueParagraph(lines: string[], index: number) {
    const line = lines[index] ?? '';
    return (
        Boolean(line.trim()) &&
        !/^```/u.test(line) &&
        !/^(#{1,6})\s+/u.test(line) &&
        !matchListItem(line) &&
        !/^\s*>\s?/u.test(line) &&
        !isTableStart(lines, index)
    );
}

function isTableStart(lines: string[], index: number) {
    return isTableRow(lines[index] ?? '') && isTableDivider(lines[index + 1] ?? '');
}

function isTableRow(line: string) {
    return line.includes('|');
}

function isTableDivider(line: string) {
    return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(line);
}

function splitTableRow(line: string) {
    return line
        .trim()
        .replace(/^\|/u, '')
        .replace(/\|$/u, '')
        .split('|')
        .map((cell) => cell.trim());
}

function matchListItem(line: string) {
    const unordered = /^\s*[-*+]\s+(.+)$/u.exec(line);
    if (unordered) {
        return { ordered: false, text: unordered[1] ?? '' };
    }

    const ordered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (ordered) {
        return { ordered: true, text: ordered[1] ?? '' };
    }

    return null;
}
