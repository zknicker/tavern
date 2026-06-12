import { createRouter } from '../trpc.ts';
import { listAgentActivityRoute } from './activity.ts';
import { listAgentChatsRoute } from './chats-list.ts';
import { listAgentCommandsProcedure, runAgentCommandProcedure } from './commands.ts';
import { deleteAgent } from './delete.ts';
import {
    getAgentExecutionSettingsProcedure,
    saveAgentExecutionSettingsProcedure,
} from './execution-settings.ts';
import { getAgent } from './get.ts';
import { getAgentInstructions } from './instructions.ts';
import { listAgents } from './list.ts';
import { onEngineRestart } from './on-engine-restart.ts';
import { onAgentInstructionsUpdate } from './on-instructions-update.ts';
import { onAgentUpdate } from './on-update.ts';
import {
    getAgentPermissionSettingsProcedure,
    saveAgentPermissionSettingsProcedure,
} from './permission-settings.ts';
import { getPrimaryAgentRoute } from './primary.ts';
import { saveAgentProfile } from './save-profile.ts';
import { saveAgentSkillsProcedure } from './save-skills.ts';
import { saveAgentToolsProcedure } from './save-tools.ts';
import { updateAgentAppearanceProcedure } from './update-appearance.ts';
import { updateAgentModelProcedure } from './update-model.ts';
import { updateAgentNameProcedure } from './update-name.ts';
import { updateAgentThinkingDefaultProcedure } from './update-thinking-default.ts';
import { getAgentWorkspaceFile, saveAgentWorkspaceFile } from './workspace-file.ts';

export const agentRouter = createRouter({
    activity: listAgentActivityRoute,
    chats: createRouter({
        list: listAgentChatsRoute,
    }),
    commands: listAgentCommandsProcedure,
    delete: deleteAgent,
    executionSettings: getAgentExecutionSettingsProcedure,
    get: getAgent,
    instructions: getAgentInstructions,
    list: listAgents,
    onEngineRestart,
    onInstructionsUpdate: onAgentInstructionsUpdate,
    onUpdate: onAgentUpdate,
    permissionSettings: getAgentPermissionSettingsProcedure,
    primary: getPrimaryAgentRoute,
    runCommand: runAgentCommandProcedure,
    saveExecutionSettings: saveAgentExecutionSettingsProcedure,
    savePermissionSettings: saveAgentPermissionSettingsProcedure,
    saveProfile: saveAgentProfile,
    saveSkills: saveAgentSkillsProcedure,
    saveTools: saveAgentToolsProcedure,
    saveWorkspaceFile: saveAgentWorkspaceFile,
    updateAppearance: updateAgentAppearanceProcedure,
    updateModel: updateAgentModelProcedure,
    updateName: updateAgentNameProcedure,
    updateThinkingDefault: updateAgentThinkingDefaultProcedure,
    workspaceFile: getAgentWorkspaceFile,
});
