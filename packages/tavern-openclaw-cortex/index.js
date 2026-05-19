import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';

import { registerTavernCortexTools } from './src/cortex-tools.js';

export default definePluginEntry({
    id: 'tavern-cortex',
    name: 'Tavern Cortex',
    description: 'First-party Tavern Cortex tools for OpenClaw agents.',
    register(api) {
        registerTavernCortexTools(api);
    },
});
