export type VaultMarkdownCommand =
    | 'blockquote'
    | 'bold'
    | 'bullet-list'
    | 'check-list'
    | 'code'
    | 'code-block'
    | 'heading-1'
    | 'heading-2'
    | 'heading-3'
    | 'italic'
    | 'link'
    | 'number-list'
    | 'wikilink';

export interface VaultMarkdownSelection {
    end: number;
    start: number;
}

export interface VaultMarkdownEdit {
    selection: VaultMarkdownSelection;
    value: string;
}

export interface VaultMarkdownStats {
    characters: number;
    lines: number;
    links: number;
    words: number;
}

export function applyMarkdownCommand(
    value: string,
    selection: VaultMarkdownSelection,
    command: VaultMarkdownCommand
): VaultMarkdownEdit {
    switch (command) {
        case 'bold':
            return wrapSelection(value, selection, '**', 'strong text');
        case 'italic':
            return wrapSelection(value, selection, '*', 'emphasis');
        case 'code':
            return wrapSelection(value, selection, '`', 'code');
        case 'link':
            return wrapSelection(
                value,
                selection,
                '[',
                selectedText(value, selection) || 'label',
                '](url)'
            );
        case 'wikilink':
            return wrapSelection(
                value,
                selection,
                '[[',
                selectedText(value, selection) || 'Page name',
                ']]'
            );
        case 'code-block':
            return wrapSelection(
                value,
                selection,
                '```\n',
                selectedText(value, selection) || 'code',
                '\n```'
            );
        case 'heading-1':
            return prefixLines(value, selection, '# ', /^#{1,6}\s*/u);
        case 'heading-2':
            return prefixLines(value, selection, '## ', /^#{1,6}\s*/u);
        case 'heading-3':
            return prefixLines(value, selection, '### ', /^#{1,6}\s*/u);
        case 'bullet-list':
            return prefixLines(value, selection, '- ', /^[-*]\s+/u);
        case 'number-list':
            return prefixLines(value, selection, '1. ', /^\d+\.\s+/u);
        case 'check-list':
            return prefixLines(value, selection, '- [ ] ', /^[-*]\s+\[[ xX]\]\s+/u);
        case 'blockquote':
            return prefixLines(value, selection, '> ', /^>\s?/u);
    }
}

export function getMarkdownStats(value: string): VaultMarkdownStats {
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/u).length : 0;
    const wikilinks = value.match(/\[\[[^\]]+\]\]/gu)?.length ?? 0;
    const markdownLinks = value.match(/\[[^\]]+\]\([^)]+\)/gu)?.length ?? 0;

    return {
        characters: value.length,
        lines: value.length === 0 ? 1 : value.split('\n').length,
        links: wikilinks + markdownLinks,
        words,
    };
}

function selectedText(value: string, selection: VaultMarkdownSelection) {
    return value.slice(selection.start, selection.end);
}

function wrapSelection(
    value: string,
    selection: VaultMarkdownSelection,
    before: string,
    placeholder: string,
    after = before
): VaultMarkdownEdit {
    const selected = selectedText(value, selection);
    const inner = selected || placeholder;
    const nextValue = `${value.slice(0, selection.start)}${before}${inner}${after}${value.slice(selection.end)}`;
    const start = selection.start + before.length;
    const end = start + inner.length;

    return {
        selection: { end, start },
        value: nextValue,
    };
}

function prefixLines(
    value: string,
    selection: VaultMarkdownSelection,
    prefix: string,
    replacePattern: RegExp
): VaultMarkdownEdit {
    const lineRange = getSelectedLineRange(value, selection);
    const block = value.slice(lineRange.start, lineRange.end);
    const lines = block.split('\n');
    const nextBlock = lines
        .map((line) => {
            if (!line.trim()) {
                return line;
            }
            return `${prefix}${line.replace(replacePattern, '')}`;
        })
        .join('\n');

    return {
        selection: {
            end: lineRange.start + nextBlock.length,
            start: lineRange.start,
        },
        value: `${value.slice(0, lineRange.start)}${nextBlock}${value.slice(lineRange.end)}`,
    };
}

function getSelectedLineRange(value: string, selection: VaultMarkdownSelection) {
    const start = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
    const selectedEnd = selection.end > selection.start ? selection.end : selection.start;
    const nextLineBreak = value.indexOf('\n', selectedEnd);
    const end = nextLineBreak === -1 ? value.length : nextLineBreak;

    return { end, start };
}
