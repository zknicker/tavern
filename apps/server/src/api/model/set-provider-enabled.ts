import { z } from 'zod';
import { setModelProviderEnabled } from '../../model/provider-service.ts';
import { emitModelUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

export const setModelProviderEnabledProcedure = publicProcedure
    .input(
        z.object({
            enabled: z.boolean().default(true),
            providerId: z.string().trim().min(1),
        })
    )
    .mutation(async ({ input }) => {
        const result = await setModelProviderEnabled(input);
        emitModelUpdated();
        return result;
    });
