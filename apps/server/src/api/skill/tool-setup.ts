import {
    toolEnvSaveInputSchema,
    toolIdInputSchema,
    toolPostSetupInputSchema,
    toolProviderSelectInputSchema,
} from '../../skills/contracts.ts';
import {
    getToolConfig,
    runToolPostSetup,
    saveToolEnv,
    setToolProvider,
} from '../../skills/tool-setup-service.ts';
import { publicProcedure } from '../trpc.ts';

export const toolConfigProcedure = publicProcedure
    .input(toolIdInputSchema)
    .query(async ({ input }) => await getToolConfig(input));

export const setToolProviderProcedure = publicProcedure
    .input(toolProviderSelectInputSchema)
    .mutation(async ({ input }) => await setToolProvider(input));

export const saveToolEnvProcedure = publicProcedure
    .input(toolEnvSaveInputSchema)
    .mutation(async ({ input }) => await saveToolEnv(input));

export const runToolPostSetupProcedure = publicProcedure
    .input(toolPostSetupInputSchema)
    .mutation(async ({ input }) => await runToolPostSetup(input));
