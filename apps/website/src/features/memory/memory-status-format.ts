import type { BadgeProps } from '../../components/ui/badge.tsx';
import type { SemanticMemorySettingsOutput, SemanticMemoryStatusOutput } from '../../lib/trpc.tsx';

export type SemanticMemoryHubStatus = NonNullable<SemanticMemoryStatusOutput>;
export type SemanticMemorySettings = NonNullable<SemanticMemorySettingsOutput>;

export function formatSemanticMemoryAccess(
    status: Pick<SemanticMemoryHubStatus, 'readable' | 'writable'> | null
) {
    if (!status) {
        return 'Unavailable';
    }

    if (status.readable && status.writable) {
        return 'Readable and writable';
    }

    if (status.readable) {
        return 'Read-only';
    }

    return 'Unavailable';
}

export function formatSemanticMemoryConfigSource(source: SemanticMemorySettings['configSource']) {
    switch (source) {
        case 'default':
            return 'Default';
        case 'environment':
            return 'Environment';
        case 'settings':
            return 'Settings';
    }
}

export function getSemanticMemoryHealth(status: SemanticMemoryHubStatus | null): {
    label: string;
    variant: BadgeProps['variant'];
} {
    if (!status?.readable) {
        return { label: 'Unavailable', variant: 'destructive' };
    }

    if (!status.writable) {
        return { label: 'Read-only', variant: 'warning' };
    }

    return { label: 'Enabled', variant: 'success' };
}
