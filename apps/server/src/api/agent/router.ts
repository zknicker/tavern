import { createRouter } from '../trpc.ts';
import { agentActivityFeedRoute } from './activity-feed.ts';
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
import { listAgentPresenceRoute } from './presence.ts';
import { getPrimaryAgentRoute } from './primary.ts';
import { saveAgentProfile } from './save-profile.ts';
import { saveAgentSkillsProcedure } from './save-skills.ts';
import { getAgentSessionProcedure, resetAgentSessionProcedure } from './session.ts';
import { updateAgentBioProcedure } from './update-bio.ts';
import { updateAgentModelProcedure } from './update-model.ts';
import { updateAgentNameProcedure } from './update-name.ts';
import { updateAgentTaskSettingsProcedure } from './update-task-settings.ts';
import { updateAgentThinkingDefaultProcedure } from './update-thinking-default.ts';
import { updateAgentWebSettingsProcedure } from './update-web-settings.ts';
import {
    getAgentWorkspaceFile,
    getAgentWorkspaceReadableFile,
    listAgentWorkspaceFiles,
    saveAgentWorkspaceFile,
} from './workspace-file.ts';

export const agentRouter = createRouter({
    activity: agentActivityFeedRoute,
    presence: listAgentPresenceRoute,
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
    updateBio: updateAgentBioProcedure,
    updateModel: updateAgentModelProcedure,
    updateName: updateAgentNameProcedure,
    updateThinkingDefault: updateAgentThinkingDefaultProcedure,
    updateTaskSettings: updateAgentTaskSettingsProcedure,
    updateWebSettings: updateAgentWebSettingsProcedure,
    workspaceFile: getAgentWorkspaceFile,
    workspaceFiles: listAgentWorkspaceFiles,
    workspaceReadableFile: getAgentWorkspaceReadableFile,
});
