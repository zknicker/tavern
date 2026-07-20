import { agentRuntimeSaveTimezoneSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getTimezoneSettingsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await client.getTimezoneSettings();
    } finally {
        client.close();
    }
});

export const saveTimezoneSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveTimezoneSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            return await client.saveTimezoneSettings(input);
        } finally {
            client.close();
        }
    });
