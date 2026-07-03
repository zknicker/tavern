export interface SemanticMemoryMarkdownStats {
    characters: number;
    lines: number;
    links: number;
    words: number;
}

export function getMarkdownStats(value: string): SemanticMemoryMarkdownStats {
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/u).length : 0;
    const memoryLinks = value.match(/\[\[[^\]]+\]\]/gu)?.length ?? 0;
    const markdownLinks = value.match(/\[[^\]]+\]\([^)]+\)/gu)?.length ?? 0;

    return {
        characters: value.length,
        lines: value.length === 0 ? 1 : value.split('\n').length,
        links: memoryLinks + markdownLinks,
        words,
    };
}
