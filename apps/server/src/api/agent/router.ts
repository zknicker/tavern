import { createRouter } from '../trpc.ts';
import { listAgentActivityRoute } from './activity.ts';
import { deleteAgent } from './delete.ts';
import { getAgent } from './get.ts';
import { listAgents } from './list.ts';
import { onAgentUpdate } from './on-update.ts';
import { getPrimaryAgentRoute } from './primary.ts';
import { saveAgentProfile } from './save-profile.ts';
import { saveAgentSkillsProcedure } from './save-skills.ts';
import { saveAgentToolsProcedure } from './save-tools.ts';

export const agentRouter = createRouter({
    activity: listAgentActivityRoute,
    delete: deleteAgent,
    get: getAgent,
    list: listAgents,
    onUpdate: onAgentUpdate,
    primary: getPrimaryAgentRoute,
    saveProfile: saveAgentProfile,
    saveSkills: saveAgentSkillsProcedure,
    saveTools: saveAgentToolsProcedure,
});
