const WIKI_LINK_HREF_PREFIX = '/.tavern-wiki-link/';

export function toMdxEditorMarkdown(value: string) {
    return transformMarkdownText(value, replaceWikiLinks);
}

export function fromMdxEditorMarkdown(value: string) {
    return transformMarkdownText(value, replaceEditorWikiLinks);
}

function transformMarkdownText(value: string, transformLine: (line: string) => string) {
    const lines = value.split('\n');
    let fence: '`' | '~' | null = null;

    return lines
        .map((line) => {
            const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
            if (fenceMatch) {
                const marker = fenceMatch[1]?.[0] === '~' ? '~' : '`';
                if (!fence) {
                    fence = marker;
                } else if (fence === marker) {
                    fence = null;
                }
                return line;
            }

            return fence ? line : transformOutsideInlineCode(line, transformLine);
        })
        .join('\n');
}

function transformOutsideInlineCode(line: string, transformText: (text: string) => string) {
    let output = '';
    let cursor = 0;

    while (cursor < line.length) {
        const codeStart = line.indexOf('`', cursor);
        if (codeStart === -1) {
            output += transformText(line.slice(cursor));
            break;
        }

        output += transformText(line.slice(cursor, codeStart));
        const tickRun = /^`+/u.exec(line.slice(codeStart))?.[0] ?? '`';
        const codeEnd = line.indexOf(tickRun, codeStart + tickRun.length);

        if (codeEnd === -1) {
            output += transformText(line.slice(codeStart));
            break;
        }

        output += line.slice(codeStart, codeEnd + tickRun.length);
        cursor = codeEnd + tickRun.length;
    }

    return output;
}

function replaceWikiLinks(text: string) {
    let output = '';
    let cursor = 0;

    while (cursor < text.length) {
        const start = text.indexOf('[[', cursor);
        if (start === -1) {
            output += text.slice(cursor);
            break;
        }

        const end = text.indexOf(']]', start + 2);
        if (end === -1) {
            output += text.slice(cursor);
            break;
        }

        const parsed = parseWikiLink(text.slice(start + 2, end));
        if (!parsed) {
            output += text.slice(cursor, end + 2);
            cursor = end + 2;
            continue;
        }

        output += text.slice(cursor, start);
        output += `[${escapeMarkdownLabel(parsed.label)}](${toEditorWikiLinkHref(parsed.target)})`;
        cursor = end + 2;
    }

    return output;
}

function replaceEditorWikiLinks(text: string) {
    let output = '';
    let cursor = 0;

    while (cursor < text.length) {
        const start = text.indexOf('[', cursor);
        if (start === -1) {
            output += text.slice(cursor);
            break;
        }

        if (text[start - 1] === '!') {
            output += text.slice(cursor, start + 1);
            cursor = start + 1;
            continue;
        }

        const labelEnd = findClosingBracket(text, start + 1, ']');
        if (labelEnd === -1 || text[labelEnd + 1] !== '(') {
            output += text.slice(cursor, start + 1);
            cursor = start + 1;
            continue;
        }

        const hrefEnd = findClosingBracket(text, labelEnd + 2, ')');
        if (hrefEnd === -1) {
            output += text.slice(cursor, start + 1);
            cursor = start + 1;
            continue;
        }

        const target = fromEditorWikiLinkHref(text.slice(labelEnd + 2, hrefEnd));
        if (!target) {
            output += text.slice(cursor, hrefEnd + 1);
            cursor = hrefEnd + 1;
            continue;
        }

        const label = unescapeMarkdownLabel(text.slice(start + 1, labelEnd)).trim();
        output += text.slice(cursor, start);
        output += formatWikiLink(target, label || target);
        cursor = hrefEnd + 1;
    }

    return output;
}

function parseWikiLink(value: string) {
    const [targetPart, ...labelParts] = value.split('|');
    const target = targetPart?.trim() ?? '';
    if (!target) {
        return null;
    }

    return {
        label: labelParts.join('|').trim() || target,
        target,
    };
}

function formatWikiLink(target: string, label: string) {
    return label === target ? `[[${target}]]` : `[[${target}|${label}]]`;
}

function toEditorWikiLinkHref(target: string) {
    return `${WIKI_LINK_HREF_PREFIX}${encodeURIComponent(target)}`;
}

function fromEditorWikiLinkHref(value: string) {
    const href = value.trim().replace(/^<|>$/gu, '');
    if (!href.startsWith(WIKI_LINK_HREF_PREFIX)) {
        return null;
    }

    try {
        return decodeURIComponent(href.slice(WIKI_LINK_HREF_PREFIX.length));
    } catch {
        return null;
    }
}

function findClosingBracket(text: string, cursor: number, closing: ']' | ')') {
    let escaped = false;
    for (let index = cursor; index < text.length; index += 1) {
        const character = text[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\') {
            escaped = true;
            continue;
        }
        if (character === closing) {
            return index;
        }
    }

    return -1;
}

function escapeMarkdownLabel(value: string) {
    return value.replace(/[\\[\]]/gu, '\\$&');
}

function unescapeMarkdownLabel(value: string) {
    return value.replace(/\\([\\[\]])/gu, '$1');
}
