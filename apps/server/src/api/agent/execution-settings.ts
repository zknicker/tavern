import { agentRuntimeSaveExecutionSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getAgentExecutionSettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.getExecutionSettings();
    } finally {
        client.close();
    }
});

export const saveAgentExecutionSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveExecutionSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.saveExecutionSettings(input);
        } finally {
            client.close();
        }
    });
