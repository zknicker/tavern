import { createRouter } from '../trpc.ts';
import { getSkillProcedure } from './get.ts';
import { skillHubAvailableProcedure } from './hub-available.ts';
import { skillHubInstallProcedure } from './hub-install.ts';
import { skillHubPreviewProcedure } from './hub-preview.ts';
import { skillHubScanProcedure } from './hub-scan.ts';
import {
    skillHubTapAddProcedure,
    skillHubTapListProcedure,
    skillHubTapRemoveProcedure,
} from './hub-taps.ts';
import { skillHubUninstallProcedure } from './hub-uninstall.ts';
import { listSkillsProcedure } from './list.ts';
import { listRuntimeSkillsProcedure } from './list-runtime.ts';
import { onSkillUpdate } from './on-update.ts';
import { setSkillEnabledProcedure } from './set-enabled.ts';
import { setToolEnabledProcedure } from './set-tool-enabled.ts';
import {
    runToolPostSetupProcedure,
    saveToolEnvProcedure,
    setToolProviderProcedure,
    toolConfigProcedure,
} from './tool-setup.ts';

export const skillRouter = createRouter({
    list: listSkillsProcedure,
    get: getSkillProcedure,
    runtimeList: listRuntimeSkillsProcedure,
    onUpdate: onSkillUpdate,
    setEnabled: setSkillEnabledProcedure,
    setToolEnabled: setToolEnabledProcedure,
    hubAvailable: skillHubAvailableProcedure,
    hubPreview: skillHubPreviewProcedure,
    hubScan: skillHubScanProcedure,
    hubInstall: skillHubInstallProcedure,
    hubUninstall: skillHubUninstallProcedure,
    hubTaps: skillHubTapListProcedure,
    hubTapAdd: skillHubTapAddProcedure,
    hubTapRemove: skillHubTapRemoveProcedure,
    toolConfig: toolConfigProcedure,
    setToolProvider: setToolProviderProcedure,
    saveToolEnv: saveToolEnvProcedure,
    runToolPostSetup: runToolPostSetupProcedure,
});
