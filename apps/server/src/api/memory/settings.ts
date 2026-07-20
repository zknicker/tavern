import { agentRuntimeSaveMemorySettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getMemorySettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await client.getMemorySettings();
    } finally {
        client.close();
    }
});

export const saveMemorySettingsProcedure = publicProcedure
    .input(agentRuntimeSaveMemorySettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            return await client.saveMemorySettings(input);
        } finally {
            client.close();
        }
    });
