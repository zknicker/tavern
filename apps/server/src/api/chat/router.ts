import { createRouter } from '../trpc.ts';
import { archiveChatRoute } from './archive.ts';
import { createChatRoute } from './create.ts';
import { getChatRoute } from './get.ts';
import { listChatsRoute } from './list.ts';
import { dismissChatLogRowRoute } from './log-dismiss.ts';
import { listChatLogRoute } from './log-list.ts';
import { onChatLogUpdate } from './log-on-update.ts';
import { onChatTurnCancelled } from './on-turn-cancelled.ts';
import { onChatTurnCompleted } from './on-turn-completed.ts';
import { onChatTurnFailed } from './on-turn-failed.ts';
import { onChatTurnProgress } from './on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './on-turn-reply-updated.ts';
import { onChatTurnStarted } from './on-turn-started.ts';
import { onChatTurnStatusUpdated } from './on-turn-status-updated.ts';
import { onChatUpdate } from './on-update.ts';
import { sendChatMessageRoute } from './send.ts';
import { setChatPinnedRoute } from './set-pinned.ts';
import { startChatRoute } from './start.ts';
import { startChatAgentSessionRoute } from './start-agent-session.ts';
import { steerChatTurnRoute } from './steer.ts';
import { stopChatTurnRoute } from './stop.ts';
import { getChatToolRoute } from './tool-get.ts';
import { updateChatRoute } from './update.ts';
import { updateChatSystemPromptRoute } from './update-system-prompt.ts';
import { updateChatTabAppearanceRoute } from './update-tab-appearance.ts';

export const chatRouter = createRouter({
    archive: archiveChatRoute,
    create: createChatRoute,
    get: getChatRoute,
    tool: createRouter({
        get: getChatToolRoute,
    }),
    list: listChatsRoute,
    log: createRouter({
        dismiss: dismissChatLogRowRoute,
        list: listChatLogRoute,
        onUpdate: onChatLogUpdate,
    }),
    onUpdate: onChatUpdate,
    onTurnCancelled: onChatTurnCancelled,
    onTurnCompleted: onChatTurnCompleted,
    onTurnFailed: onChatTurnFailed,
    onTurnProgress: onChatTurnProgress,
    onTurnReplyUpdated: onChatTurnReplyUpdated,
    onTurnStarted: onChatTurnStarted,
    onTurnStatusUpdated: onChatTurnStatusUpdated,
    send: sendChatMessageRoute,
    setPinned: setChatPinnedRoute,
    startAgentSession: startChatAgentSessionRoute,
    start: startChatRoute,
    steer: steerChatTurnRoute,
    stop: stopChatTurnRoute,
    updateTabAppearance: updateChatTabAppearanceRoute,
    updateSystemPrompt: updateChatSystemPromptRoute,
    update: updateChatRoute,
});
