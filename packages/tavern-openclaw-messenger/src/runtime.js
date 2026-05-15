import { createPluginRuntimeStore } from 'openclaw/plugin-sdk/runtime-store';

const { getRuntime: getTavernChannelRuntime, setRuntime: setTavernChannelRuntime } =
    createPluginRuntimeStore({
        errorMessage: 'Tavern channel runtime is not initialized.',
        pluginId: 'tavern',
    });

export { getTavernChannelRuntime, setTavernChannelRuntime };
