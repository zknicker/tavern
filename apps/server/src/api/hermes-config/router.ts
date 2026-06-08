import { createRouter } from '../trpc.ts';
import { applyHermesConfigProcedure } from './apply.ts';
import { getHermesConfigProcedure } from './get.ts';
import { onHermesConfigUpdate } from './on-update.ts';

export const hermesConfigRouter = createRouter({
    get: getHermesConfigProcedure,
    onUpdate: onHermesConfigUpdate,
    save: applyHermesConfigProcedure,
});
