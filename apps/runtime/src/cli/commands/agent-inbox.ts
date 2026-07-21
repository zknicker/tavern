import { AgentCliError } from '../agent-error.ts';
import type { SubCommand } from '../subcommand.ts';

export const INBOX_SUBCOMMANDS: SubCommand[] = [
    {
        examples: ['grotto inbox check'],
        flags: [],
        name: 'check',
        positionals: [],
        run: () => {
            throw new AgentCliError(
                'NOT_YET_AVAILABLE',
                'Inbox cursor semantics arrive with the inbox workstream.',
                { nextAction: 'grotto message read --target <t>' }
            );
        },
        summary: 'Check pending targets without draining them (arrives with inbox cursors)',
        usage: 'grotto inbox check',
    },
];
