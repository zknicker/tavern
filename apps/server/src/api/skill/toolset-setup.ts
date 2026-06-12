import {
    toolsetEnvSaveInputSchema,
    toolsetIdInputSchema,
    toolsetPostSetupInputSchema,
    toolsetProviderSelectInputSchema,
} from '../../skills/contracts.ts';
import {
    getToolsetConfig,
    runToolsetPostSetup,
    saveToolsetEnv,
    setToolsetProvider,
} from '../../skills/toolset-setup-service.ts';
import { publicProcedure } from '../trpc.ts';

export const toolsetConfigProcedure = publicProcedure
    .input(toolsetIdInputSchema)
    .query(async ({ input }) => await getToolsetConfig(input));

export const setToolsetProviderProcedure = publicProcedure
    .input(toolsetProviderSelectInputSchema)
    .mutation(async ({ input }) => await setToolsetProvider(input));

export const saveToolsetEnvProcedure = publicProcedure
    .input(toolsetEnvSaveInputSchema)
    .mutation(async ({ input }) => await saveToolsetEnv(input));

export const runToolsetPostSetupProcedure = publicProcedure
    .input(toolsetPostSetupInputSchema)
    .mutation(async ({ input }) => await runToolsetPostSetup(input));
