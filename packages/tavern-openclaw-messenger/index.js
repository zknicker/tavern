import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';

import { tavernChannelPlugin } from './src/channel.js';
import { setTavernChannelRuntime } from './src/runtime.js';

export default defineChannelPluginEntry({
    id: 'tavern',
    name: 'Tavern Messenger',
    description: 'First-party Tavern chat channel for OpenClaw.',
    plugin: tavernChannelPlugin,
    setRuntime: setTavernChannelRuntime,
});
