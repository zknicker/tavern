import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

import { registerGeneratedFileGuard } from './src/generated-file-guard.js';
import { registerWorkspaceNotesTools } from './src/workspace-notes-tools.js';

export default definePluginEntry({
    id: 'tavern-workspace',
    name: 'Tavern Workspace',
    description: 'First-party Tavern managed workspace tools and policy.',
    register(api) {
        registerWorkspaceNotesTools(api);
        registerGeneratedFileGuard(api, {
            workspaceDir: process.env.TAVERN_MANAGED_WORKSPACE_DIR,
        });
    },
});
