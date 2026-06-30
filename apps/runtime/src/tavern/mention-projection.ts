import fs from 'node:fs/promises';
import path from 'node:path';
import { agentRuntimeMessageMetadataSchema } from '@tavern/api';
import { AGENT_HOME } from '../config';

interface SkillContext {
    content: string;
    name: string;
    path: string;
}

export async function projectTavernMessageForAgent(input: { content: string; metadata?: unknown }) {
    const skills = await resolveMentionedSkills(input.metadata);
    if (skills.length === 0) {
        return input.content;
    }

    const skillBlocks = skills.map(
        (skill) =>
            `<skill name="${escapeAttribute(skill.name)}" path="${escapeAttribute(skill.path)}">\n${skill.content.trim()}\n</skill>`
    );

    return [
        '<skill_context>',
        'The user explicitly referenced these skills. Follow their instructions for this turn.',
        '',
        skillBlocks.join('\n\n'),
        '</skill_context>',
        '',
        input.content,
    ]
        .join('\n')
        .trim();
}

async function resolveMentionedSkills(metadata: unknown) {
    const parsed = agentRuntimeMessageMetadataSchema.safeParse(metadata);
    if (!parsed.success) {
        return [];
    }

    const mentions = parsed.data.tavern?.mentions ?? [];
    const skillMentions = mentions.filter(
        (mention) => mention.kind === 'skill' && mention.projection === 'skill-context'
    );
    const seen = new Set<string>();
    const skills: SkillContext[] = [];

    for (const mention of skillMentions) {
        const name = mentionSkillName(mention);
        const skill = await readMentionSkill({
            id: mention.id,
            metadata: mention.metadata,
            name,
        });
        if (!skill) {
            continue;
        }
        const key = `${skill.name}\0${skill.path}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        skills.push(skill);
    }

    return skills;
}

async function readMentionSkill(input: {
    id: string;
    metadata?: Record<string, unknown>;
    name: string;
}): Promise<SkillContext | null> {
    for (const candidate of skillPathCandidates(input)) {
        const content = await fs.readFile(candidate, 'utf8').catch(() => null);
        if (content === null) {
            continue;
        }
        return {
            content,
            name: input.name,
            path: candidate,
        };
    }

    return null;
}

function skillPathCandidates(input: {
    id: string;
    metadata?: Record<string, unknown>;
    name: string;
}) {
    const rawCandidates = [
        readMetadataString(input.metadata, 'filePath'),
        readMetadataString(input.metadata, 'skillPath'),
        readMetadataString(input.metadata, 'path'),
        input.id,
    ];
    const paths = new Set<string>();

    for (const candidate of rawCandidates) {
        if (!candidate) {
            continue;
        }
        if (path.isAbsolute(candidate)) {
            paths.add(
                candidate.endsWith('SKILL.md') ? candidate : path.join(candidate, 'SKILL.md')
            );
        }
    }

    for (const name of [input.name, input.id]) {
        const normalized = stripSkillSigil(name);
        if (normalized && !normalized.includes('/') && !normalized.includes(':')) {
            paths.add(path.join(AGENT_HOME, 'skills', normalized, 'SKILL.md'));
        }
    }

    return [...paths];
}

function mentionSkillName(mention: {
    id: string;
    label: string;
    metadata?: Record<string, unknown>;
    text: string;
}) {
    return (
        readMetadataString(mention.metadata, 'skillName') ??
        readMetadataString(mention.metadata, 'skillKey') ??
        stripSkillSigil(mention.label) ??
        stripSkillSigil(mention.text) ??
        stripSkillSigil(mention.id) ??
        'skill'
    );
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stripSkillSigil(value: string) {
    const trimmed = value.trim();
    const markdown = /^\[\$?([^\]]+)\]\(([^)]+)\)$/u.exec(trimmed);
    const source = markdown?.[1] ?? path.basename(trimmed);
    return (
        source
            .replace(/^\$/u, '')
            .replace(/\/?SKILL\.md$/u, '')
            .trim() || null
    );
}

function escapeAttribute(value: string) {
    return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}
