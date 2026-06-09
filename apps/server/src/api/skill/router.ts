import { createRouter } from '../trpc.ts';
import { listSkillsProcedure } from './list.ts';
import { listRuntimeSkillsProcedure } from './list-runtime.ts';
import { onSkillUpdate } from './on-update.ts';
import { setSkillEnabledProcedure } from './set-enabled.ts';
import { setToolsetEnabledProcedure } from './set-toolset-enabled.ts';

export const skillRouter = createRouter({
    list: listSkillsProcedure,
    runtimeList: listRuntimeSkillsProcedure,
    onUpdate: onSkillUpdate,
    setEnabled: setSkillEnabledProcedure,
    setToolsetEnabled: setToolsetEnabledProcedure,
});
