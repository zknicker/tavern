import { createRouter } from '../trpc.ts';
import { skillHubCatalogProcedure } from './hub-catalog.ts';
import { skillHubInstallProcedure } from './hub-install.ts';
import { skillHubPreviewProcedure } from './hub-preview.ts';
import { skillHubScanProcedure } from './hub-scan.ts';
import { skillHubSearchProcedure } from './hub-search.ts';
import {
    skillHubTapAddProcedure,
    skillHubTapListProcedure,
    skillHubTapRemoveProcedure,
} from './hub-taps.ts';
import { skillHubUninstallProcedure } from './hub-uninstall.ts';
import { listSkillsProcedure } from './list.ts';
import { listRuntimeSkillsProcedure } from './list-runtime.ts';
import {
    addMcpServerProcedure,
    installMcpCatalogEntryProcedure,
    mcpCatalogProcedure,
    mcpServersProcedure,
    removeMcpServerProcedure,
    setMcpServerEnabledProcedure,
    testMcpServerProcedure,
} from './mcp.ts';
import { onSkillUpdate } from './on-update.ts';
import { setSkillEnabledProcedure } from './set-enabled.ts';
import { setToolsetEnabledProcedure } from './set-toolset-enabled.ts';
import {
    runToolsetPostSetupProcedure,
    saveToolsetEnvProcedure,
    setToolsetProviderProcedure,
    toolsetConfigProcedure,
} from './toolset-setup.ts';

export const skillRouter = createRouter({
    list: listSkillsProcedure,
    runtimeList: listRuntimeSkillsProcedure,
    onUpdate: onSkillUpdate,
    setEnabled: setSkillEnabledProcedure,
    setToolsetEnabled: setToolsetEnabledProcedure,
    hubCatalog: skillHubCatalogProcedure,
    hubSearch: skillHubSearchProcedure,
    hubPreview: skillHubPreviewProcedure,
    hubScan: skillHubScanProcedure,
    hubInstall: skillHubInstallProcedure,
    hubUninstall: skillHubUninstallProcedure,
    hubTaps: skillHubTapListProcedure,
    hubTapAdd: skillHubTapAddProcedure,
    hubTapRemove: skillHubTapRemoveProcedure,
    toolsetConfig: toolsetConfigProcedure,
    setToolsetProvider: setToolsetProviderProcedure,
    saveToolsetEnv: saveToolsetEnvProcedure,
    runToolsetPostSetup: runToolsetPostSetupProcedure,
    mcpServers: mcpServersProcedure,
    addMcpServer: addMcpServerProcedure,
    removeMcpServer: removeMcpServerProcedure,
    testMcpServer: testMcpServerProcedure,
    setMcpServerEnabled: setMcpServerEnabledProcedure,
    mcpCatalog: mcpCatalogProcedure,
    installMcpCatalogEntry: installMcpCatalogEntryProcedure,
});
