import { createRouter } from '../trpc.ts';
import { listAgentActivityRoute } from './activity.ts';
import { listAgentChatsRoute } from './chats-list.ts';
import { deleteAgent } from './delete.ts';
import { getAgent } from './get.ts';
import { getAgentInstructions } from './instructions.ts';
import { listAgents } from './list.ts';
import { onAgentInstructionsUpdate } from './on-instructions-update.ts';
import { onAgentUpdate } from './on-update.ts';
import { getPrimaryAgentRoute } from './primary.ts';
import { saveAgentProfile } from './save-profile.ts';
import { saveAgentSkillsProcedure } from './save-skills.ts';
import { saveAgentToolsProcedure } from './save-tools.ts';
import { updateAgentModelProcedure } from './update-model.ts';
import { updateAgentNameProcedure } from './update-name.ts';
import { updateAgentThinkingDefaultProcedure } from './update-thinking-default.ts';

export const agentRouter = createRouter({
    activity: listAgentActivityRoute,
    chats: createRouter({
        list: listAgentChatsRoute,
    }),
    delete: deleteAgent,
    get: getAgent,
    instructions: getAgentInstructions,
    list: listAgents,
    onInstructionsUpdate: onAgentInstructionsUpdate,
    onUpdate: onAgentUpdate,
    primary: getPrimaryAgentRoute,
    saveProfile: saveAgentProfile,
    saveSkills: saveAgentSkillsProcedure,
    saveTools: saveAgentToolsProcedure,
    updateModel: updateAgentModelProcedure,
    updateName: updateAgentNameProcedure,
    updateThinkingDefault: updateAgentThinkingDefaultProcedure,
});
