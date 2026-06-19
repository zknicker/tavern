export interface VaultMarkdownStats {
    characters: number;
    lines: number;
    links: number;
    words: number;
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
