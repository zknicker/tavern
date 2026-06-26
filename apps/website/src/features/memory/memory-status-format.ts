import type { BadgeProps } from '../../components/ui/badge.tsx';
import type { VaultSettingsOutput, VaultStatusOutput } from '../../lib/trpc.tsx';

export type VaultHubStatus = NonNullable<VaultStatusOutput>;
export type VaultSettings = NonNullable<VaultSettingsOutput>;

export function formatVaultAccess(status: Pick<VaultHubStatus, 'readable' | 'writable'> | null) {
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

export function formatVaultConfigSource(source: VaultSettings['configSource']) {
    switch (source) {
        case 'default':
            return 'Default';
        case 'environment':
            return 'Environment';
        case 'settings':
            return 'Settings';
    }
}

export function getVaultHealth(status: VaultHubStatus | null): {
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
