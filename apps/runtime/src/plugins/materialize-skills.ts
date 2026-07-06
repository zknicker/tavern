import fs from 'node:fs/promises';
import path from 'node:path';
import { tavernPluginManifests } from '@tavern/api/plugins';
import { AGENT_HOME } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { publishSkillUpdated } from '../skills/events.ts';
import { readSkillSource, recordSkillSource, sha256 } from '../skills/store.ts';
import {
    findPluginServiceForSkill,
    isPluginServiceEnabled,
    pluginSkillContent,
} from './agent-capabilities.ts';
import { getPlugin } from './store.ts';

const defaultSkillsDir = path.join(AGENT_HOME, 'skills');

export interface MaterializePluginSkillsResult {
    created: string[];
    preserved: string[];
    refreshed: string[];
}

export async function materializePluginSkills(
    input: { db?: Database; skillsDir?: string } = {}
): Promise<MaterializePluginSkillsResult> {
    const db = input.db ?? getDb();
    const skillsDir = input.skillsDir ?? defaultSkillsDir;
    const result: MaterializePluginSkillsResult = {
        created: [],
        preserved: [],
        refreshed: [],
    };

    for (const definition of tavernPluginManifests) {
        const plugin = getPlugin(definition.id);
        if (!plugin.enabled) {
            continue;
        }

        for (const service of definition.services) {
            if (!isPluginServiceEnabled(service, plugin.config)) {
                continue;
            }

            const content = pluginSkillContent(service);
            const generatedHash = sha256(content);
            for (const skill of service.skills) {
                const status = await materializePluginSkill({
                    content,
                    db,
                    generatedHash,
                    skillId: skill.name,
                    skillsDir,
                });
                result[status].push(skill.name);
            }
        }
    }

    return result;
}

export async function resetPluginSkillToDefault(
    skillId: string,
    input: { db?: Database; skillsDir?: string } = {}
) {
    const match = findPluginServiceForSkill(skillId);
    if (!match) {
        return null;
    }

    const content = pluginSkillContent(match.service);
    const hash = sha256(content);
    const skillsDir = input.skillsDir ?? defaultSkillsDir;
    const skillPath = pluginSkillPath({ skillId, skillsDir });
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, content, { mode: 0o600 });
    recordSkillSource({
        db: input.db,
        installedHash: hash,
        skillId,
        source: 'plugin',
    });
    publishSkillUpdated(skillId);
    return { hash, skillId };
}

async function materializePluginSkill(input: {
    content: string;
    db: Database;
    generatedHash: string;
    skillId: string;
    skillsDir: string;
}): Promise<keyof MaterializePluginSkillsResult> {
    const skillPath = pluginSkillPath(input);
    const previous = await fs.readFile(skillPath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });

    if (previous === null) {
        await writePluginSkill(input);
        return 'created';
    }

    const source = readSkillSource(input.skillId, input.db);
    const currentHash = sha256(previous);
    if (!source && currentHash === input.generatedHash) {
        recordPluginSource(input);
        return 'preserved';
    }
    if (source?.source !== 'plugin') {
        return 'preserved';
    }

    if (!source.installedHash) {
        if (currentHash === input.generatedHash) {
            recordPluginSource(input);
        }
        return 'preserved';
    }

    if (currentHash === source.installedHash && input.generatedHash !== source.installedHash) {
        await writePluginSkill(input);
        return 'refreshed';
    }

    return 'preserved';
}

async function writePluginSkill(input: {
    content: string;
    db: Database;
    generatedHash: string;
    skillId: string;
    skillsDir: string;
}) {
    const skillPath = pluginSkillPath(input);
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, input.content, { mode: 0o600 });
    recordPluginSource(input);
    publishSkillUpdated(input.skillId);
}

function recordPluginSource(input: { db?: Database; generatedHash: string; skillId: string }) {
    recordSkillSource({
        db: input.db,
        installedHash: input.generatedHash,
        skillId: input.skillId,
        source: 'plugin',
    });
}

function pluginSkillPath(input: { skillId: string; skillsDir: string }) {
    return path.join(input.skillsDir, input.skillId, 'SKILL.md');
}

function isNotFoundError(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
