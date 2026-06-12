import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// Composer slash commands: list the engine catalog and run one command in a
// chat's session. See specs/composer-commands.md.
export const listAgentCommandsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.listCommands();
    } finally {
        client.close();
    }
});

const runAgentCommandInputSchema = z.object({
    agentId: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    command: z.string().trim().min(1).max(2000),
});

export const runAgentCommandProcedure = publicProcedure
    .input(runAgentCommandInputSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.runCommand(input);
        } finally {
            client.close();
        }
    });
