import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import type { ChatContextFullness } from '../chats/chat-context-fullness.ts';
import type { MentionOption } from './mention-types.ts';

/**
 * Engine command catalog mapped into picker options for the `/` palette.
 * Selecting one inserts `/name ` as plain text; execution happens on submit.
 * See specs/composer-commands.md.
 */
export function useCommandOptions({
    contextFullness,
    enabled,
}: {
    contextFullness?: ChatContextFullness | null;
    enabled: boolean;
}): MentionOption[] {
    const commands = trpc.agent.commands.useQuery(undefined, {
        ...queryPolicy.agentRuntimeSnapshot,
        enabled,
    });

    return React.useMemo(
        () =>
            (commands.data?.commands ?? []).map((command) => ({
                description: commandDescription(command.description, command.name, contextFullness),
                id: command.name,
                insertText: `${command.name} `,
                kind: 'command' as const,
                label: command.name,
                projection: 'capability-reference' as const,
                sourceLabel: command.category,
                ...(isContextCommand(command.name) && contextFullness
                    ? {
                          statusAdornment: {
                              kind: 'context-fullness' as const,
                              percent: contextFullness.percent,
                          },
                      }
                    : {}),
            })),
        [commands.data, contextFullness]
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

function commandDescription(
    description: string | null,
    name: string,
    contextFullness?: ChatContextFullness | null
) {
    if (!(isContextCommand(name) && contextFullness)) {
        return description;
    }

    const percentLabel = `${Math.round(contextFullness.percent * 100)}% full`;
    return description ? `${description} (${percentLabel})` : `Context (${percentLabel})`;
}

function isContextCommand(name: string) {
    const normalized = name.trim().toLowerCase();
    return normalized === '/context' || normalized === '/compress' || normalized === '/compact';
}
