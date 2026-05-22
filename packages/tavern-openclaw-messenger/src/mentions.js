export function buildBodyForAgentWithMentions({ metadata, text }) {
    const mentions = readMentions(metadata);

    if (mentions.length === 0) {
        return text;
    }

    const skillBlocks = mentions
        .filter((mention) => mention.projection === 'skill-context')
        .map(formatSkillBlock);
    const sections = [];

    if (skillBlocks.length > 0) {
        sections.push(...skillBlocks);
    }

    return sections.length > 0 ? [...sections, '', text].join('\n') : text;
}

function readMentions(metadata) {
    const tavern = readRecord(metadata)?.tavern;
    const rawTavern = readRecord(tavern);
    const rawMentions = Array.isArray(rawTavern?.mentions) ? rawTavern.mentions : [];

    const seen = new Set();
    const mentions = [];

    for (const rawMention of rawMentions) {
        const mention = normalizeMention(rawMention);

        if (!mention) {
            continue;
        }

        const key = `${mention.projection}:${mention.kind}:${mention.id}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        mentions.push(mention);
    }

    return mentions;
}

function normalizeMention(value) {
    const record = readRecord(value);
    const id = readNonEmptyString(record?.id);
    const kind = normalizeKind(readNonEmptyString(record?.kind));
    const label = readNonEmptyString(record?.label);
    const text = readNonEmptyString(record?.text);
    const projection = normalizeProjection(readNonEmptyString(record?.projection), kind);

    if (!(record && id && kind && label && projection)) {
        return null;
    }

    return { id, kind, label, projection, text };
}

function formatSkillBlock(mention) {
    return [
        '<skill>',
        `<name>${escapeXml(readSkillMentionName(mention) ?? mention.label)}</name>`,
        `<path>${escapeXml(mention.id)}</path>`,
        '</skill>',
    ].join('\n');
}

function readSkillMentionName(mention) {
    const text = readNonEmptyString(mention.text);

    if (!text) {
        return null;
    }

    const markdownMatch = /^\[\$([^\]]+)\]\(/u.exec(text);
    if (markdownMatch?.[1]) {
        return markdownMatch[1].trim() || null;
    }

    if (text.startsWith('$')) {
        return text.slice(1).trim() || null;
    }

    return null;
}

function normalizeKind(value) {
    if (value === 'tool') {
        return 'plugin';
    }

    if (
        value === 'app' ||
        value === 'directory' ||
        value === 'file' ||
        value === 'image' ||
        value === 'plugin' ||
        value === 'skill'
    ) {
        return value;
    }

    return null;
}

function normalizeProjection(value, kind) {
    if (
        value === 'capability-reference' ||
        value === 'image-input' ||
        value === 'path-reference' ||
        value === 'skill-context'
    ) {
        return value;
    }

    if (kind === 'skill') {
        return 'skill-context';
    }

    if (kind === 'app' || kind === 'plugin') {
        return 'capability-reference';
    }

    if (kind === 'file' || kind === 'directory') {
        return 'path-reference';
    }

    if (kind === 'image') {
        return 'image-input';
    }

    return null;
}

function readRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
