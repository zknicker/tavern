import { createRouter } from '../trpc.ts';
import { deleteSkillSecretProcedure } from './delete-secret.ts';
import { getSkillProcedure } from './get.ts';
import { listSkillsProcedure } from './list.ts';
import { listRuntimeSkillsProcedure } from './list-runtime.ts';
import { onSkillUpdate } from './on-update.ts';
import { saveSkillSecretProcedure } from './save-secret.ts';

export const skillRouter = createRouter({
    deleteSecret: deleteSkillSecretProcedure,
    get: getSkillProcedure,
    list: listSkillsProcedure,
    runtimeList: listRuntimeSkillsProcedure,
    onUpdate: onSkillUpdate,
    saveSecret: saveSkillSecretProcedure,
});
