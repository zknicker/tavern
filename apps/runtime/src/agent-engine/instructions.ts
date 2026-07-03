import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeAgent } from '@tavern/api';
import { AGENT_WORKSPACE } from '../config.ts';
import type { Database } from '../db/sqlite.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import {
    generateAgentInstructions,
    getAgentWorkspaceSource,
    registerAgentWorkspace,
} from '../workspace/instructions.ts';
import { seedTavernAgentSkill } from './skill-library.ts';

export const agentEngineAgentId = 'main';

const userFileName = 'USER.md';
const memoryFileName = 'MEMORY.md';
const soulFileName = 'SOUL.md';
const defaultUser = '';
const defaultMemory = '';
const defaultSoul = `# SOUL.md

You are the resident Tavern agent.

Be direct, pragmatic, and useful. Keep the user's momentum. Prefer concrete action over vague narration.
`;

export async function prepareAgentEngineInstructions(
    db: Database,
    agent: AgentRuntimeAgent | string = agentEngineAgentId,
    options: {
        seedSkills?: boolean;
        skillsDir?: string;
    } = {}
) {
    const agentId = typeof agent === 'string' ? agent : agent.id;
    const agentName = typeof agent === 'string' ? 'Tavern' : agent.name;
    const workspaceDir = typeof agent === 'string' ? AGENT_WORKSPACE : agent.workspaceFolder;
    const source =
        getAgentWorkspaceSource(db, agentId) ??
        registerAgentWorkspace(db, {
            agentId,
            agentName,
            workspaceDir,
        });
    const generated = await generateAgentInstructions(db, source.agentId);
    const coreMemory = isMemoryEnabled()
        ? await readOrSeedCoreMemoryFiles({ workspaceDir: source.workspaceDir })
        : null;
    const soul = await readOrSeedSoul({ workspaceDir: source.workspaceDir });
    const instructions = composeAgentEngineInstructions({
        agentInstructions: generated.content,
        coreMemory,
        soul,
    });

    if (options.seedSkills !== false) {
        await seedTavernAgentSkill({ skillsDir: options.skillsDir });
    }

    return {
        content: instructions,
        source,
    };
}

async function readOrSeedCoreMemoryFiles(input: { workspaceDir: string }) {
    const [user, memory] = await Promise.all([
        readOrSeedWorkspaceFile({
            defaultContent: defaultUser,
            fileName: userFileName,
            workspaceDir: input.workspaceDir,
        }),
        readOrSeedWorkspaceFile({
            defaultContent: defaultMemory,
            fileName: memoryFileName,
            workspaceDir: input.workspaceDir,
        }),
    ]);

    return { memory, user };
}

async function readOrSeedSoul(input: { workspaceDir: string }) {
    const soulPath = path.join(input.workspaceDir, soulFileName);
    const existing = await fs.readFile(soulPath, 'utf8').catch(() => null);

    if (existing !== null) {
        return existing;
    }

    await fs.mkdir(path.dirname(soulPath), { recursive: true });
    await fs.writeFile(soulPath, defaultSoul, { mode: 0o600 });
    return defaultSoul;
}

async function readOrSeedWorkspaceFile(input: {
    defaultContent: string;
    fileName: string;
    workspaceDir: string;
}) {
    const filePath = path.join(input.workspaceDir, input.fileName);
    const existing = await fs.readFile(filePath, 'utf8').catch(() => null);

    if (existing !== null) {
        return existing;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.defaultContent, { mode: 0o600 });
    return input.defaultContent;
}

function composeAgentEngineInstructions(input: {
    agentInstructions: string;
    coreMemory: { memory: string; user: string } | null;
    soul: string;
}) {
    const sections = [
        input.agentInstructions.trim(),
        input.coreMemory
            ? [
                  '## USER',
                  'The following content comes from `USER.md` in your workspace. Edit this file directly for agent-local stable facts about the user.',
                  input.coreMemory.user.trim(),
                  '## MEMORY',
                  'The following content comes from `MEMORY.md` in your workspace. Edit this file directly for agent-local durable working memory.',
                  input.coreMemory.memory.trim(),
              ].join('\n\n')
            : null,
        '## SOUL',
        'The following content comes from `SOUL.md` in your workspace. To change your identity, voice, or personality, edit `SOUL.md` directly. Changes apply on your next turn.',
        input.soul.trim(),
    ].filter((section): section is string => Boolean(section));

    return sections.join('\n\n');
}
