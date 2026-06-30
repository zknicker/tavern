import type { ActiveMentionQuery, MentionOption } from './mention-types.ts';
import { filterCommandOptionsForQuery } from './use-command-options.ts';

export function selectVisibleOptions({
    activeQuery,
    commandArgumentOptions,
    commandOptions,
    mentionOptions,
    supportsCommands,
}: {
    activeQuery: ActiveMentionQuery | null;
    commandArgumentOptions?: MentionOption[] | null;
    commandOptions: MentionOption[];
    mentionOptions: MentionOption[];
    supportsCommands: boolean;
}) {
    if (!activeQuery) {
        return [];
    }

    if (activeQuery.trigger === '/') {
        if (commandArgumentOptions) {
            return commandArgumentOptions;
        }

        return supportsCommands
            ? filterCommandOptionsForQuery(commandOptions, activeQuery.query)
            : [];
    }

    if (activeQuery.trigger === '$') {
        return mentionOptions.filter((option) => option.kind === 'skill');
    }

    return mentionOptions.filter((option) => option.kind === 'agent');
}
