export type ChatMarkdownBlock = ChatMarkdownHeadingBlock | ChatMarkdownProseBlock;

export interface ChatMarkdownHeadingBlock {
    depth: number;
    kind: 'heading';
    start: number;
    text: string;
    textStart: number;
}

interface ChatMarkdownProseBlock {
    kind: 'prose';
    start: number;
    text: string;
}

export function parseChatMarkdownBlocks(content: string): ChatMarkdownBlock[] {
    const blocks: ChatMarkdownBlock[] = [];
    let proseStart: number | null = null;
    let prose = '';
    let offset = 0;
    let inFence: null | string = null;

    const flushProse = () => {
        if (proseStart === null) {
            return;
        }

        const trimmed = trimBoundaryNewlines(prose);

        blocks.push({
            kind: 'prose',
            start: proseStart + trimmed.startOffset,
            text: trimmed.text,
        });

        prose = '';
        proseStart = null;
    };

    for (const line of splitMarkdownLines(content)) {
        const lineText = line.endsWith('\n') ? line.slice(0, -1) : line;
        const fence = matchFence(lineText);

        if (fence) {
            inFence = inFence === fence ? null : (inFence ?? fence);
        }

        const heading = inFence ? null : matchHeading(lineText, offset);

        if (heading) {
            flushProse();
            blocks.push(heading);
        } else {
            proseStart ??= offset;
            prose += line;
        }

        offset += line.length;
    }

    flushProse();
    return blocks.length > 0 ? blocks : [{ kind: 'prose', start: 0, text: content }];
}

function splitMarkdownLines(content: string) {
    if (content.length === 0) {
        return [''];
    }

    return content.match(/[^\n]*(?:\n|$)/gu)?.filter((line) => line.length > 0) ?? [content];
}

function matchHeading(line: string, lineStart: number): ChatMarkdownHeadingBlock | null {
    const match = /^([ \t]{0,3})(#{1,6})([ \t]+)(.*)$/u.exec(line);

    if (!match) {
        return null;
    }

    const [, indent = '', markers = '', separator = '', rawText = ''] = match;
    const text = rawText.replace(/[ \t]+#{1,}[ \t]*$/u, '').trimEnd();

    if (text.length === 0) {
        return null;
    }

    return {
        depth: markers.length,
        kind: 'heading',
        start: lineStart,
        text,
        textStart: lineStart + indent.length + markers.length + separator.length,
    };
}

function matchFence(line: string) {
    const match = /^[ \t]{0,3}(`{3,}|~{3,})/u.exec(line);

    return match?.[1]?.[0] ?? null;
}

function trimBoundaryNewlines(text: string) {
    const startOffset = /^\n*/u.exec(text)?.[0].length ?? 0;
    const endOffset = /\n*$/u.exec(text)?.[0].length ?? 0;
    const end = endOffset === 0 ? text.length : text.length - endOffset;

    return {
        startOffset,
        text: text.slice(startOffset, end),
    };
}
