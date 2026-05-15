import { createRouter } from '../trpc.ts';
import { applyOpenClawConfigProcedure } from './apply.ts';
import { getOpenClawConfigProcedure } from './get.ts';
import { onOpenClawConfigUpdate } from './on-update.ts';

export const openClawConfigRouter = createRouter({
    get: getOpenClawConfigProcedure,
    onUpdate: onOpenClawConfigUpdate,
    save: applyOpenClawConfigProcedure,
});
