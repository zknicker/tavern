const prettyNameOverrides = new Map<string, string>([
    ['ai', 'AI'],
    ['api', 'API'],
    ['ci', 'CI'],
    ['cli', 'CLI'],
    ['codex', 'Codex'],
    ['css', 'CSS'],
    ['csv', 'CSV'],
    ['github', 'GitHub'],
    ['html', 'HTML'],
    ['json', 'JSON'],
    ['llm', 'LLM'],
    ['mcp', 'MCP'],
    ['openai', 'OpenAI'],
    ['pdf', 'PDF'],
    ['pr', 'PR'],
    ['sdk', 'SDK'],
    ['ui', 'UI'],
    ['url', 'URL'],
]);

export function formatSkillName(name: string) {
    const normalizedName = normalizeQualifiedName(name);

    return normalizedName
        .split(/[-_\s]+/u)
        .filter(Boolean)
        .map(formatNamePart)
        .join(' ');
}

function normalizeQualifiedName(name: string) {
    const [prefix, ...rest] = name.split(':');
    if (!prefix || rest.length === 0) {
        return name;
    }

    const suffix = rest.join(':');
    return normalizeNameToken(prefix) === normalizeNameToken(suffix) ? suffix : name;
}

function normalizeNameToken(name: string) {
    return name
        .split(/[-_\s:]+/u)
        .filter(Boolean)
        .map((part) => part.toLowerCase())
        .join(' ');
}

function formatNamePart(part: string) {
    const lower = part.toLowerCase();
    return prettyNameOverrides.get(lower) ?? `${lower[0]?.toUpperCase() ?? ''}${lower.slice(1)}`;
}
