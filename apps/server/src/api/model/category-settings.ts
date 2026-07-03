import { agentRuntimeSaveModelCategorySettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getModelCategorySettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.getModelCategorySettings();
    } finally {
        client.close();
    }
});

export const saveModelCategorySettingsProcedure = publicProcedure
    .input(agentRuntimeSaveModelCategorySettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.saveModelCategorySettings(input);
        } finally {
            client.close();
        }
    });
