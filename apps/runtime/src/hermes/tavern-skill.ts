import path from 'node:path';
import { HERMES_HOME } from '../config';
import { resolveRuntimeAssetsRoot, syncManagedSkillDirectory } from './managed-vault';

export const tavernSkillName = 'tavern';

interface ManagedTavernSkillInput {
    assetsRoot?: string;
    hermesHome?: string;
}

/**
 * Install the managed `tavern` skill: the agent's product knowledge of and
 * operational access to Tavern (chats, deliveries, automations, settings map).
 * Runtime owns the content and refreshes it on every startup.
 */
export async function ensureManagedTavernSkill(input: ManagedTavernSkillInput = {}) {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', tavernSkillName);
    const skillPath = path.join(input.hermesHome ?? HERMES_HOME, 'skills', tavernSkillName);

    await syncManagedSkillDirectory(skillSource, skillPath);

    return { skillPath };
}
