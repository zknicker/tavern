import type {
    SkillHubAvailableOutput,
    SkillHubItemOutput,
    SkillListOutput,
} from '../../lib/trpc.tsx';

type SkillSummary = SkillListOutput['skills'][number];
export type ManagedSource = 'hub' | 'plugin' | 'seeded';
export interface HubEntry {
    edited: boolean;
    identifier: string;
    trustLevel: null | string;
    updateAvailable: boolean;
}
export type HubByName = Map<string, HubEntry>;

/** Runtime-owned managed-skill flags keyed by skill name. */
export interface RuntimeManagedFlags {
    edited?: boolean;
    managedSource?: ManagedSource | null;
    updateAvailable?: boolean;
}
export type RuntimeManagedByName = Map<string, RuntimeManagedFlags>;

export interface SkillTreeSubject {
    dependencyState: SkillSummary['dependencyState'];
    description: null | string;
    diagnostic: null | string;
    edited: boolean;
    enabled?: boolean;
    identifier: null | string;
    installed: boolean;
    managedSource: ManagedSource | null;
    name: string;
    plugin: SkillSummary['plugin'];
    readOnly: boolean;
    skillId: null | string;
    sourceLabel: string;
    treePath: string;
    trustLevel?: 'builtin' | 'community' | 'trusted';
    uninstallName: null | string;
    updateAvailable: boolean;
    updatedAt: null | string;
}

export function buildSkillTreeSubjects(input: {
    available?: SkillHubAvailableOutput;
    hubByName: HubByName;
    runtimeByName?: RuntimeManagedByName;
    skills: SkillSummary[];
}) {
    const runtimeByName = input.runtimeByName ?? new Map();
    const subjects: SkillTreeSubject[] = [];

    for (const skill of input.skills) {
        subjects.push(installedTreeSubject(skill, input.hubByName, runtimeByName));
    }

    if (input.available) {
        for (const tap of input.available.taps) {
            for (const item of tap.skills) {
                subjects.push(
                    availableTreeSubject(
                        item,
                        input.skills,
                        input.hubByName,
                        runtimeByName,
                        tap.repo
                    )
                );
            }
        }
        for (const item of input.available.builtin) {
            subjects.push(
                availableTreeSubject(
                    item,
                    input.skills,
                    input.hubByName,
                    runtimeByName,
                    'Built-in library'
                )
            );
        }
    }

    return subjects;
}

export function buildSkillTreePaths(subjects: SkillTreeSubject[]) {
    const paths = new Set<string>();
    for (const subject of subjects) {
        addFolderAncestors(paths, subject.treePath);
        paths.add(subject.treePath);
    }
    return [...paths];
}

function installedTreeSubject(
    skill: SkillSummary,
    hubByName: HubByName,
    runtimeByName: RuntimeManagedByName
): SkillTreeSubject {
    const hubEntry = hubByName.get(skill.name);
    const managed = resolveManagedFlags(runtimeByName.get(skill.name), hubEntry);
    const group = skill.plugin ? `Plugin Skills/${skill.plugin.displayName}` : 'Installed skills';

    return {
        dependencyState: skill.dependencyState,
        description: skill.description,
        diagnostic: skill.diagnostic,
        edited: managed.edited,
        enabled: skill.enabled,
        identifier: hubEntry?.identifier ?? null,
        installed: true,
        managedSource: managed.managedSource,
        name: skill.name,
        plugin: skill.plugin,
        readOnly: skill.readOnly,
        skillId: skill.id,
        sourceLabel: skill.plugin ? skill.plugin.displayName : 'Installed',
        treePath: skillFilePath(group, skill.name),
        trustLevel: skill.plugin ? 'builtin' : narrowTrustLevel(hubEntry?.trustLevel),
        uninstallName: hubEntry ? skill.name : null,
        updateAvailable: managed.updateAvailable,
        updatedAt: skill.updatedAt,
    };
}

function availableTreeSubject(
    item: SkillHubItemOutput,
    skills: SkillSummary[],
    hubByName: HubByName,
    runtimeByName: RuntimeManagedByName,
    sourceLabel: string
): SkillTreeSubject {
    const installedEntry = hubByName.get(item.name);
    const inventorySkill = installedEntry
        ? skills.find((skill) => skill.name === item.name)
        : undefined;
    const managed = resolveManagedFlags(runtimeByName.get(item.name), installedEntry);

    return {
        dependencyState: inventorySkill?.dependencyState ?? 'unknown',
        description: item.description || inventorySkill?.description || null,
        diagnostic: inventorySkill?.diagnostic ?? null,
        edited: managed.edited,
        enabled: inventorySkill?.enabled,
        identifier: item.identifier,
        installed: installedEntry !== undefined,
        managedSource: managed.managedSource,
        name: item.name,
        plugin: inventorySkill?.plugin ?? null,
        readOnly: inventorySkill?.readOnly ?? false,
        skillId: inventorySkill?.id ?? null,
        sourceLabel,
        treePath: skillFilePath(`Available skills/${sourceLabel}`, item.name),
        trustLevel: item.trustLevel,
        uninstallName: installedEntry ? item.name : null,
        updateAvailable: managed.updateAvailable,
        updatedAt: inventorySkill?.updatedAt ?? null,
    };
}

/**
 * Prefer runtime-owned managed flags; fall back to the hub entry when the
 * runtime summary omits a field so hub-installed skills keep working.
 */
function resolveManagedFlags(
    runtime: RuntimeManagedFlags | undefined,
    hubEntry: HubEntry | undefined
) {
    return {
        edited: runtime?.edited ?? hubEntry?.edited ?? false,
        managedSource: runtime?.managedSource ?? (hubEntry ? 'hub' : null),
        updateAvailable: runtime?.updateAvailable ?? hubEntry?.updateAvailable ?? false,
    };
}

function skillFilePath(group: string, name: string) {
    return `${normalizeTreePath(group)}/${normalizeTreePath(name)}/SKILL.md`;
}

function normalizeTreePath(value: string) {
    return value
        .trim()
        .replace(/\\/gu, '/')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    for (let index = 0; index < segments.length - 1; index += 1) {
        paths.add(`${segments.slice(0, index + 1).join('/')}/`);
    }
}

function narrowTrustLevel(value: null | string | undefined) {
    return value === 'builtin' || value === 'community' || value === 'trusted' ? value : undefined;
}
