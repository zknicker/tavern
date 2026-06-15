import { agentRuntimeSaveAgentEnvSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getAgentEnvSettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.getAgentEnv();
    } finally {
        client.close();
    }
});

export const saveAgentEnvSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveAgentEnvSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.saveAgentEnv(input);
        } finally {
            client.close();
        }
    });
