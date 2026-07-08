import type { BadgeProps } from '../../components/ui/badge.tsx';
import type { WikiSettingsOutput, WikiStatusOutput } from '../../lib/trpc.tsx';

export type WikiHubStatus = NonNullable<WikiStatusOutput>;
export type WikiSettings = NonNullable<WikiSettingsOutput>;

export function formatWikiAccess(status: Pick<WikiHubStatus, 'readable' | 'writable'> | null) {
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

export function formatWikiConfigSource(source: WikiSettings['configSource']) {
    switch (source) {
        case 'default':
            return 'Default';
        case 'environment':
            return 'Environment';
        case 'settings':
            return 'Settings';
    }
}

export function getWikiHealth(status: WikiHubStatus | null): {
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
