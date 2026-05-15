import { parse, stringify } from 'yaml';

export interface SkillMetadataMap {
    [key: string]: unknown;
}

interface ParsedSkillDocument {
    allowedTools: string | null;
    bodyMarkdown: string;
    compatibility: string | null;
    description: string | null;
    extraFields: Record<string, unknown>;
    license: string | null;
    metadata: SkillMetadataMap | null;
    name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringField(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadataField(value: unknown) {
    if (!isRecord(value)) {
        return null;
    }

    const entries = Object.entries(value);

    return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function buildMetadataYaml(metadata: SkillMetadataMap | null) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return null;
    }

    return stringify(metadata, {
        lineWidth: 0,
    }).trimEnd();
}

function quoteInvalidYamlScalars(frontmatter: string) {
    return frontmatter
        .split('\n')
        .map((line) => {
            const match = /^(\s*[^:#\s][^:]*:\s*)(.+)$/.exec(line);

            if (!match) {
                return line;
            }

            const [, prefix, value] = match;
            const trimmed = value.trim();

            if (
                !trimmed.includes(':') ||
                trimmed.startsWith('"') ||
                trimmed.startsWith("'") ||
                trimmed.startsWith('|') ||
                trimmed.startsWith('>')
            ) {
                return line;
            }

            return `${prefix}${JSON.stringify(trimmed)}`;
        })
        .join('\n');
}

function parseFrontmatterObject(frontmatter: null | string) {
    if (!frontmatter) {
        return {};
    }

    try {
        const parsed = parse(frontmatter);
        return isRecord(parsed) ? parsed : {};
    } catch {
        try {
            const parsed = parse(quoteInvalidYamlScalars(frontmatter));
            return isRecord(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
}

function extractSkillDocument(contentMarkdown: string) {
    const normalized = contentMarkdown.replaceAll('\r\n', '\n');
    const trimmed = normalized.trimStart();

    if (!trimmed.startsWith('---')) {
        return {
            bodyMarkdown: trimmed,
            frontmatter: null,
        };
    }

    const lines = trimmed.split('\n');

    if (lines[0]?.trim() !== '---') {
        return {
            bodyMarkdown: trimmed,
            frontmatter: null,
        };
    }

    const endLineIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');

    if (endLineIndex === -1) {
        return {
            bodyMarkdown: trimmed,
            frontmatter: null,
        };
    }

    return {
        bodyMarkdown: lines
            .slice(endLineIndex + 1)
            .join('\n')
            .trimStart(),
        frontmatter: lines.slice(1, endLineIndex).join('\n'),
    };
}

function readLegacyMetadataFromBody(bodyMarkdown: string) {
    const normalized = bodyMarkdown.replaceAll('\r\n', '\n').trimStart();
    const lines = normalized.split('\n');
    let index = 0;

    if (lines[index]?.trim() === '---') {
        index += 1;
    }

    while (lines[index]?.trim() === '') {
        index += 1;
    }

    const nameLine = lines[index]?.trim() ?? '';
    const nameMatch = /^##\s*name:\s*(.+)$/i.exec(nameLine);

    if (!nameMatch) {
        return null;
    }

    const fields = new Map<string, string>([['name', nameMatch[1].trim()]]);
    index += 1;

    while (index < lines.length) {
        const trimmed = lines[index]?.trim() ?? '';

        if (trimmed.length === 0) {
            const nextNonEmptyIndex = lines.findIndex(
                (line, candidateIndex) => candidateIndex > index && line.trim().length > 0
            );

            if (nextNonEmptyIndex === -1 || lines[nextNonEmptyIndex]?.trim().startsWith('#')) {
                index = nextNonEmptyIndex === -1 ? lines.length : nextNonEmptyIndex;
                break;
            }

            index += 1;
            continue;
        }

        if (trimmed.startsWith('#')) {
            break;
        }

        const separatorIndex = trimmed.indexOf(':');

        if (separatorIndex <= 0) {
            break;
        }

        fields.set(
            trimmed.slice(0, separatorIndex).trim(),
            trimmed.slice(separatorIndex + 1).trim()
        );
        index += 1;
    }

    return {
        bodyMarkdown: lines.slice(index).join('\n').trimStart(),
        fields,
    };
}

function extractFallbackDescription(bodyMarkdown: string) {
    for (const line of bodyMarkdown.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed === '---' || trimmed.startsWith('#')) {
            continue;
        }

        return trimmed;
    }

    return null;
}

function splitKnownFields(input: Record<string, unknown>) {
    const {
        'allowed-tools': rawAllowedTools,
        compatibility: rawCompatibility,
        description: rawDescription,
        license: rawLicense,
        metadata: rawMetadata,
        name: rawName,
        ...extraFields
    } = input;

    return {
        allowedTools: normalizeStringField(rawAllowedTools),
        compatibility: normalizeStringField(rawCompatibility),
        description: normalizeStringField(rawDescription),
        extraFields,
        license: normalizeStringField(rawLicense),
        metadata: normalizeMetadataField(rawMetadata),
        name: normalizeStringField(rawName),
    };
}

function parseSkillDocument(input: {
    contentMarkdown: string;
    skillId: string;
}): ParsedSkillDocument {
    const extracted = extractSkillDocument(input.contentMarkdown);
    const parsedFrontmatter = splitKnownFields(parseFrontmatterObject(extracted.frontmatter));
    const legacy = readLegacyMetadataFromBody(extracted.bodyMarkdown);
    const frontmatterDescription =
        parsedFrontmatter.description === '---' ? null : parsedFrontmatter.description;
    const frontmatterName = parsedFrontmatter.name === '---' ? null : parsedFrontmatter.name;
    const allowedTools =
        parsedFrontmatter.allowedTools ?? legacy?.fields.get('allowed-tools')?.trim() ?? null;
    const compatibility =
        parsedFrontmatter.compatibility ?? legacy?.fields.get('compatibility')?.trim() ?? null;
    const license = parsedFrontmatter.license ?? legacy?.fields.get('license')?.trim() ?? null;
    const name = frontmatterName ?? legacy?.fields.get('name')?.trim() ?? input.skillId;
    const description =
        frontmatterDescription ??
        legacy?.fields.get('description')?.trim() ??
        extractFallbackDescription(legacy?.bodyMarkdown ?? extracted.bodyMarkdown);

    return {
        allowedTools,
        bodyMarkdown: legacy?.bodyMarkdown ?? extracted.bodyMarkdown,
        compatibility,
        description,
        extraFields: parsedFrontmatter.extraFields,
        license,
        metadata: parsedFrontmatter.metadata,
        name,
    };
}

export function normalizeSkillMarkdown(input: { contentMarkdown: string; skillId: string }) {
    const parsed = parseSkillDocument(input);

    return {
        allowedTools: parsed.allowedTools,
        bodyMarkdown: parsed.bodyMarkdown,
        compatibility: parsed.compatibility,
        description: parsed.description,
        license: parsed.license,
        metadata: parsed.metadata,
        metadataYaml: buildMetadataYaml(parsed.metadata),
        name: parsed.name,
        normalizedContentMarkdown:
            parsed.description === null
                ? input.contentMarkdown.replaceAll('\r\n', '\n')
                : buildSkillMarkdown({
                      allowedTools: parsed.allowedTools,
                      bodyMarkdown: parsed.bodyMarkdown,
                      compatibility: parsed.compatibility,
                      contentMarkdown: input.contentMarkdown,
                      description: parsed.description,
                      license: parsed.license,
                      metadata: parsed.metadata,
                      skillId: input.skillId,
                  }),
    };
}

export function parseSkillMarkdown(input: { contentMarkdown: string; skillId: string }) {
    const parsed = normalizeSkillMarkdown(input);

    return {
        allowedTools: parsed.allowedTools,
        bodyMarkdown: parsed.bodyMarkdown,
        compatibility: parsed.compatibility,
        description: parsed.description,
        license: parsed.license,
        metadata: parsed.metadata,
        metadataYaml: parsed.metadataYaml,
        name: parsed.name,
    };
}

export function parseSkillMetadataYaml(input: null | string) {
    const trimmed = input?.trim() ?? '';

    if (trimmed.length === 0) {
        return null;
    }

    let parsed: unknown;

    try {
        parsed = parse(trimmed);
    } catch (error) {
        throw new Error(
            error instanceof Error
                ? `Metadata YAML is invalid: ${error.message}`
                : 'Metadata YAML is invalid.'
        );
    }

    if (!isRecord(parsed)) {
        throw new Error('Metadata YAML must be a map of keys to string values.');
    }

    const metadata: SkillMetadataMap = {};

    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
            metadata[key] = value;
            continue;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            metadata[key] = String(value);
            continue;
        }

        throw new Error('Metadata YAML must only contain string, number, or boolean values.');
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
}

export function buildSkillMarkdown(input: {
    allowedTools: null | string;
    bodyMarkdown: string;
    compatibility: null | string;
    contentMarkdown: null | string;
    description: string;
    license: null | string;
    metadata: SkillMetadataMap | null;
    skillId: string;
}) {
    const parsed = parseSkillDocument({
        contentMarkdown: input.contentMarkdown ?? '',
        skillId: input.skillId,
    });
    const frontmatter: Record<string, unknown> = {
        name: input.skillId.trim(),
        description: input.description.trim(),
    };

    if (input.license?.trim()) {
        frontmatter.license = input.license.trim();
    }

    if (input.compatibility?.trim()) {
        frontmatter.compatibility = input.compatibility.trim();
    }

    if (input.metadata && Object.keys(input.metadata).length > 0) {
        frontmatter.metadata = input.metadata;
    }

    if (input.allowedTools?.trim()) {
        frontmatter['allowed-tools'] = input.allowedTools.trim();
    }

    for (const [key, value] of Object.entries(parsed.extraFields)) {
        if (!(key in frontmatter)) {
            frontmatter[key] = value;
        }
    }

    const serializedFrontmatter = stringify(frontmatter, {
        lineWidth: 0,
    }).trimEnd();
    const bodyMarkdown = input.bodyMarkdown.replaceAll('\r\n', '\n');

    return bodyMarkdown.length > 0
        ? `---\n${serializedFrontmatter}\n---\n\n${bodyMarkdown}`
        : `---\n${serializedFrontmatter}\n---\n`;
}

export function createSkillTemplate(skillId: string) {
    return buildSkillMarkdown({
        allowedTools: null,
        bodyMarkdown: `# ${skillId}\n\nExplain what this skill does and the steps the agent should follow.\n`,
        compatibility: null,
        contentMarkdown: null,
        description: 'Describe when this skill should be used.',
        license: null,
        metadata: null,
        skillId,
    });
}
