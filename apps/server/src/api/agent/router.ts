import { createRouter } from '../trpc.ts';
import { listAgentActivityRoute } from './activity.ts';
import { listAgentChatsRoute } from './chats-list.ts';
import { createAgentProcedure } from './create.ts';
import { deleteAgent } from './delete.ts';
import { getAgentEnvSettingsProcedure, saveAgentEnvSettingsProcedure } from './env-settings.ts';
import { getAgent } from './get.ts';
import { getAgentInstructions } from './instructions.ts';
import { listAgents } from './list.ts';
import { onEngineRestart } from './on-engine-restart.ts';
import { onAgentInstructionsUpdate } from './on-instructions-update.ts';
import { onAgentUpdate } from './on-update.ts';
import { getPrimaryAgentRoute } from './primary.ts';
import { saveAgentProfile } from './save-profile.ts';
import { saveAgentSkillsProcedure } from './save-skills.ts';
import { getAgentSessionProcedure, resetAgentSessionProcedure } from './session.ts';
import { updateAgentModelProcedure } from './update-model.ts';
import { updateAgentNameProcedure } from './update-name.ts';
import { updateAgentThinkingDefaultProcedure } from './update-thinking-default.ts';
import {
    getAgentWorkspaceFile,
    getAgentWorkspaceReadableFile,
    listAgentWorkspaceFiles,
    saveAgentWorkspaceFile,
} from './workspace-file.ts';

export const agentRouter = createRouter({
    activity: listAgentActivityRoute,
    chats: createRouter({
        list: listAgentChatsRoute,
    }),
    create: createAgentProcedure,
    delete: deleteAgent,
    envSettings: getAgentEnvSettingsProcedure,
    get: getAgent,
    instructions: getAgentInstructions,
    list: listAgents,
    onEngineRestart,
    onInstructionsUpdate: onAgentInstructionsUpdate,
    onUpdate: onAgentUpdate,
    primary: getPrimaryAgentRoute,
    resetSession: resetAgentSessionProcedure,
    saveEnvSettings: saveAgentEnvSettingsProcedure,
    saveProfile: saveAgentProfile,
    saveSkills: saveAgentSkillsProcedure,
    saveWorkspaceFile: saveAgentWorkspaceFile,
    session: getAgentSessionProcedure,
    updateModel: updateAgentModelProcedure,
    updateName: updateAgentNameProcedure,
    updateThinkingDefault: updateAgentThinkingDefaultProcedure,
    workspaceFile: getAgentWorkspaceFile,
    workspaceFiles: listAgentWorkspaceFiles,
    workspaceReadableFile: getAgentWorkspaceReadableFile,
});
