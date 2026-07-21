import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;

export type RuntimeVersionMismatchKind = 'app-needs-update' | 'runtime-needs-update';

export function getRuntimeVersionMismatchKind(
    connection: RuntimeConnection
): RuntimeVersionMismatchKind {
    return compareVersions(connection.runtimeVersion, connection.requiredRuntimeVersion) > 0
        ? 'app-needs-update'
        : 'runtime-needs-update';
}

export function getRuntimeVersionMismatchReason(connection: RuntimeConnection) {
    return getRuntimeVersionMismatchKind(connection) === 'app-needs-update'
        ? 'Grotto update required.'
        : 'Grotto Runtime update required.';
}

export function getRuntimeVersionMismatchDescription(connection: RuntimeConnection) {
    if (getRuntimeVersionMismatchKind(connection) === 'app-needs-update') {
        return `Runtime ${formatVersion(connection.runtimeVersion)} is newer than this app supports. Install the latest Grotto app to restore chat and Runtime-backed settings.`;
    }

    return `Runtime ${formatVersion(connection.runtimeVersion)} is older than this app requires (${formatVersion(connection.requiredRuntimeVersion)}). Chat and Runtime-backed settings stay disabled until Runtime updates.`;
}

export function compareVersions(left?: null | string, right?: null | string) {
    if (!(left && right)) {
        return -1;
    }

    const leftParts = toVersionParts(left);
    const rightParts = toVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] ?? 0;
        const rightPart = rightParts[index] ?? 0;
        if (leftPart !== rightPart) {
            return leftPart > rightPart ? 1 : -1;
        }
    }

    return 0;
}

function formatVersion(version: null | string) {
    return version ? `v${version}` : 'an unknown version';
}

function toVersionParts(version: string) {
    return version
        .split(/[^\d]+/)
        .filter(Boolean)
        .map((part) => Number(part));
}
