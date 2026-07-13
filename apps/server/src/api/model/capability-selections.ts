import { agentRuntimeSaveModelCapabilitySelectionsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const getModelCapabilitySelectionsProcedure = publicProcedure.query(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Tavern Runtime is not connected.');
    }

    try {
        return await client.getModelCapabilitySelections();
    } finally {
        client.close();
    }
});

export const saveModelCapabilitySelectionsProcedure = publicProcedure
    .input(agentRuntimeSaveModelCapabilitySelectionsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Tavern Runtime is not connected.');
        }

        try {
            return await client.saveModelCapabilitySelections(input);
        } finally {
            client.close();
        }
    });
