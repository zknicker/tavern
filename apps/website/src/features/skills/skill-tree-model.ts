import type {
    SkillHubAvailableOutput,
    SkillHubItemOutput,
    SkillListOutput,
} from '../../lib/trpc.tsx';

type SkillSummary = SkillListOutput['skills'][number];
type HubByName = Map<string, { identifier: string; trustLevel: null | string }>;

export interface SkillTreeSubject {
    dependencyState: SkillSummary['dependencyState'];
    description: null | string;
    diagnostic: null | string;
    enabled?: boolean;
    identifier: null | string;
    installed: boolean;
    name: string;
    plugin: SkillSummary['plugin'];
    readOnly: boolean;
    skillId: null | string;
    sourceLabel: string;
    treePath: string;
    trustLevel?: 'builtin' | 'community' | 'trusted';
    uninstallName: null | string;
    updatedAt: null | string;
}

export function buildSkillTreeSubjects(input: {
    available?: SkillHubAvailableOutput;
    hubByName: HubByName;
    skills: SkillSummary[];
}) {
    const subjects: SkillTreeSubject[] = [];

    for (const skill of input.skills) {
        subjects.push(installedTreeSubject(skill, input.hubByName));
    }

    if (input.available) {
        for (const tap of input.available.taps) {
            for (const item of tap.skills) {
                subjects.push(availableTreeSubject(item, input.skills, input.hubByName, tap.repo));
            }
        }
        for (const item of input.available.builtin) {
            subjects.push(
                availableTreeSubject(item, input.skills, input.hubByName, 'Built-in library')
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

function installedTreeSubject(skill: SkillSummary, hubByName: HubByName): SkillTreeSubject {
    const hubEntry = hubByName.get(skill.name);
    const group = skill.plugin ? `Plugin Skills/${skill.plugin.displayName}` : 'Installed skills';

    return {
        dependencyState: skill.dependencyState,
        description: skill.description,
        diagnostic: skill.diagnostic,
        enabled: skill.enabled,
        identifier: hubEntry?.identifier ?? null,
        installed: true,
        name: skill.name,
        plugin: skill.plugin,
        readOnly: skill.readOnly,
        skillId: skill.id,
        sourceLabel: skill.plugin ? skill.plugin.displayName : 'Installed',
        treePath: skillFilePath(group, skill.name),
        trustLevel: skill.plugin ? 'builtin' : narrowTrustLevel(hubEntry?.trustLevel),
        uninstallName: hubEntry ? skill.name : null,
        updatedAt: skill.updatedAt,
    };
}

function availableTreeSubject(
    item: SkillHubItemOutput,
    skills: SkillSummary[],
    hubByName: HubByName,
    sourceLabel: string
): SkillTreeSubject {
    const installedEntry = hubByName.get(item.name);
    const inventorySkill = installedEntry
        ? skills.find((skill) => skill.name === item.name)
        : undefined;

    return {
        dependencyState: inventorySkill?.dependencyState ?? 'unknown',
        description: item.description || inventorySkill?.description || null,
        diagnostic: inventorySkill?.diagnostic ?? null,
        enabled: inventorySkill?.enabled,
        identifier: item.identifier,
        installed: installedEntry !== undefined,
        name: item.name,
        plugin: inventorySkill?.plugin ?? null,
        readOnly: inventorySkill?.readOnly ?? false,
        skillId: inventorySkill?.id ?? null,
        sourceLabel,
        treePath: skillFilePath(`Available skills/${sourceLabel}`, item.name),
        trustLevel: item.trustLevel,
        uninstallName: installedEntry ? item.name : null,
        updatedAt: inventorySkill?.updatedAt ?? null,
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
