import fsSync from 'node:fs';
import path from 'node:path';
import { HERMES_HOME } from '../config';
import { resolveRuntimeAssetsRoot, syncManagedSkillDirectory } from './managed-vault';

export const merchbaseSkillName = 'merchbase';
export const managedMerchbaseSkillRuntimeSource = 'tavern-integration:merchbase';
export const managedMerchbaseSkillMarkerFile = '.tavern-managed-skill';

interface ManagedMerchbaseSkillInput {
    assetsRoot?: string;
    hermesHome?: string;
    replaceExisting?: boolean;
}

type MerchbaseSkillOwnership = 'managed' | 'missing' | 'user';

export interface MerchbaseSkillState {
    ownership: MerchbaseSkillOwnership;
    skillPath: string;
}

/**
 * Install the managed `merchbase` skill: the agent's starter guide for using
 * Tavern's MerchBase Integration and choosing the MerchBase sales Rich Response.
 */
export async function ensureManagedMerchbaseSkill(input: ManagedMerchbaseSkillInput = {}) {
    const assetsRoot = input.assetsRoot ?? resolveRuntimeAssetsRoot();
    const skillSource = path.join(assetsRoot, 'hermes', 'skills', merchbaseSkillName);
    const skillPath = path.join(input.hermesHome ?? HERMES_HOME, 'skills', merchbaseSkillName);

    const ownership = readExistingMerchbaseSkillOwnership(skillPath);
    if (ownership === 'user' && !input.replaceExisting) {
        return { installed: false, skillPath };
    }

    await syncManagedSkillDirectory(skillSource, skillPath, {
        markerContent: `${managedMerchbaseSkillRuntimeSource}\n`,
        markerFile: managedMerchbaseSkillMarkerFile,
    });

    return { installed: true, skillPath };
}

export async function isManagedMerchbaseSkillInstalled(input: ManagedMerchbaseSkillInput = {}) {
    return getMerchbaseSkillState(input).ownership === 'managed';
}

export function getMerchbaseSkillState(
    input: Pick<ManagedMerchbaseSkillInput, 'hermesHome'> = {}
): MerchbaseSkillState {
    const skillPath = path.join(input.hermesHome ?? HERMES_HOME, 'skills', merchbaseSkillName);
    return {
        ownership: readExistingMerchbaseSkillOwnership(skillPath),
        skillPath,
    };
}

export function getMerchbaseSkillConflict(
    input: Pick<ManagedMerchbaseSkillInput, 'hermesHome'> = {}
) {
    const state = getMerchbaseSkillState(input);
    return state.ownership === 'user'
        ? {
              skillName: merchbaseSkillName,
              skillPath: state.skillPath,
          }
        : null;
}

function readExistingMerchbaseSkillOwnership(skillPath: string): MerchbaseSkillOwnership {
    const stats = lstatSync(skillPath);
    if (!stats) {
        return 'missing';
    }
    if (!stats.isDirectory()) {
        return 'user';
    }

    const marker = readFileSync(path.join(skillPath, managedMerchbaseSkillMarkerFile));
    if (marker?.trim() === managedMerchbaseSkillRuntimeSource) {
        return 'managed';
    }

    const skill = readFileSync(path.join(skillPath, 'SKILL.md')) ?? '';
    return isLegacyManagedMerchbaseSkill(skill) ? 'managed' : 'user';
}

function isLegacyManagedMerchbaseSkill(skill: string) {
    return (
        skill.includes('name: merchbase') &&
        skill.includes('Managed by Tavern Runtime') &&
        skill.includes('MerchBase Integration')
    );
}

function lstatSync(filePath: string) {
    try {
        return fsSync.lstatSync(filePath);
    } catch {
        return null;
    }
}

function readFileSync(filePath: string) {
    try {
        return fsSync.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}
