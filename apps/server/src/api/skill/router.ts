import { createRouter } from '../trpc.ts';
import { checkSkillUpdatesProcedure } from './check-updates.ts';
import { deleteSkillProcedure } from './delete.ts';
import { deleteSkillSecretProcedure } from './delete-secret.ts';
import { getSkillProcedure } from './get.ts';
import { installSkillProcedure } from './install.ts';
import { listSkillsProcedure } from './list.ts';
import { onSkillUpdate } from './on-update.ts';
import { saveSkillSecretProcedure } from './save-secret.ts';

export const skillRouter = createRouter({
    checkUpdates: checkSkillUpdatesProcedure,
    delete: deleteSkillProcedure,
    deleteSecret: deleteSkillSecretProcedure,
    get: getSkillProcedure,
    install: installSkillProcedure,
    list: listSkillsProcedure,
    onUpdate: onSkillUpdate,
    saveSecret: saveSkillSecretProcedure,
});
