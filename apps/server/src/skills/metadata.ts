import type { SkillMetadataMap } from './markdown.ts';

export interface SkillInstallOption {
    bins: string[];
    command: string | null;
    formula: string | null;
    id: string;
    kind: string;
    label: string;
    module: string | null;
    packageName: string | null;
}

export function readSkillSecretEnvNames(metadata: SkillMetadataMap | null) {
    const roots = readSkillRuntimeMetadata(metadata);
    const names = new Set<string>();

    for (const root of roots) {
        const primaryEnv = readString(root.primaryEnv);
        if (primaryEnv) {
            names.add(primaryEnv);
        }

        const requires = readRecord(root.requires);
        for (const envName of readStringArray(requires?.env)) {
            names.add(envName);
        }
    }

    return [...names].sort((left, right) => left.localeCompare(right));
}

export function readSkillInstallOptions(metadata: SkillMetadataMap | null): SkillInstallOption[] {
    return readSkillRuntimeMetadata(metadata).flatMap((root) => {
        const rawInstall = root.install;
        if (!Array.isArray(rawInstall)) {
            return [];
        }

        return rawInstall.flatMap((item) => {
            const record = readRecord(item);
            const id = readString(record?.id);
            const kind = readString(record?.kind);
            const label = readString(record?.label);
            const bins = readStringArray(record?.bins);
            if (!(id && kind && label && bins.length > 0)) {
                return [];
            }

            return [
                {
                    bins,
                    command: readString(record?.command),
                    formula: readString(record?.formula),
                    id,
                    kind,
                    label,
                    module: readString(record?.module),
                    packageName: readString(record?.package),
                },
            ];
        });
    });
}

export function parseSkillMetadataJson(value: string): SkillMetadataMap | null {
    try {
        const parsed = JSON.parse(value) as unknown;
        return readRecord(parsed);
    } catch {
        return null;
    }
}

function readSkillRuntimeMetadata(metadata: SkillMetadataMap | null) {
    const root = readRecord(metadata);
    const entries = [readRecord(root?.hermes), readRecord(root?.clawdbot)].filter(
        (entry): entry is Record<string, unknown> => Boolean(entry)
    );

    return entries;
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.map(readString).filter((item): item is string => Boolean(item))
        : [];
}
