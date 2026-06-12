import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import type { MentionOption } from './mention-types.ts';

/**
 * Engine command catalog mapped into picker options for the `/` palette.
 * Selecting one inserts `/name ` as plain text; execution happens on submit.
 * See specs/composer-commands.md.
 */
export function useCommandOptions({ enabled }: { enabled: boolean }): MentionOption[] {
    const commands = trpc.agent.commands.useQuery(undefined, {
        ...queryPolicy.agentRuntimeSnapshot,
        enabled,
    });

    return React.useMemo(
        () =>
            (commands.data?.commands ?? []).map((command) => ({
                description: command.description,
                id: command.name,
                insertText: `${command.name} `,
                kind: 'command' as const,
                label: command.name,
                projection: 'capability-reference' as const,
                sourceLabel: command.category,
            })),
        [commands.data]
    );
}

export function filterCommandOptionsForQuery(options: MentionOption[], query: string) {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
        return options;
    }

    return options.filter((option) =>
        [option.label, option.description ?? '', option.sourceLabel ?? '']
            .join(' ')
            .toLowerCase()
            .includes(normalized)
    );
}
