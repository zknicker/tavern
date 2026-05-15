import { useMemo } from 'react';
import type { AgentListOutput } from '../../lib/trpc.tsx';

interface ResolvedAgentAvatar {
    avatar: string;
    backgroundColor: string;
    displayName: string | null;
}

export interface DashboardAvatarDirectory {
    get: (nameOrId: null | string | undefined) => ResolvedAgentAvatar;
}

const fallbackPalette = ['#f97316', '#f59e0b', '#2563eb', '#0ea5e9', '#ec4899', '#64748b'];
const initialsSplitPattern = /[^a-zA-Z0-9]+/;

function normalizeKey(value: null | string | undefined) {
    return value?.trim().toLowerCase() ?? '';
}

function fallbackAvatar(value: string) {
    const initials = value
        .split(initialsSplitPattern)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

    if (initials) {
        return initials;
    }

    const compact = value.replace(initialsSplitPattern, '').slice(0, 2).toUpperCase();
    return compact || '?';
}

function fallbackColor(value: string) {
    const total = value.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return fallbackPalette[total % fallbackPalette.length] ?? '#64748b';
}

export function useAgentAvatarDirectory(
    agents: AgentListOutput['agents']
): DashboardAvatarDirectory {
    return useMemo(() => {
        const directory = new Map<string, ResolvedAgentAvatar>();

        for (const agent of agents) {
            const resolved = {
                avatar: agent.avatar,
                backgroundColor: agent.effectivePrimaryColor,
                displayName: agent.name ?? agent.id,
            } satisfies ResolvedAgentAvatar;

            for (const key of [agent.id, agent.name, agent.title]) {
                const normalized = normalizeKey(key);
                if (!normalized) {
                    continue;
                }

                directory.set(normalized, resolved);
            }
        }

        return {
            get(nameOrId) {
                const normalized = normalizeKey(nameOrId);
                const known = normalized ? directory.get(normalized) : null;

                if (known) {
                    return known;
                }

                const fallback = nameOrId?.trim() || 'unknown';
                return {
                    avatar: fallbackAvatar(fallback),
                    backgroundColor: fallbackColor(fallback),
                    displayName: null,
                };
            },
        };
    }, [agents]);
}
