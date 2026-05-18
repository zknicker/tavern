import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';

import { tavernChannelPlugin } from './src/channel.js';
import { registerTavernMessageIdentityHook } from './src/message-identity.js';
import { setTavernChannelRuntime } from './src/runtime.js';

function registerFull(api) {
    return registerTavernMessageIdentityHook(api);
}

export default defineChannelPluginEntry({
    id: 'tavern',
    name: 'Tavern Messenger',
    description: 'First-party Tavern chat channel for OpenClaw.',
    plugin: tavernChannelPlugin,
    registerFull,
    setRuntime: setTavernChannelRuntime,
});
