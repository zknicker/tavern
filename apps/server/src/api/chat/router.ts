import { createRouter } from '../trpc.ts';
import { respondToChatApprovalRoute } from './approval-respond.ts';
import { archiveChatRoute } from './archive.ts';
import { respondToChatClarificationRoute } from './clarification-respond.ts';
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
import { onChatUpdate } from './on-update.ts';
import { sendChatMessageRoute } from './send.ts';
import { setChatPinnedRoute } from './set-pinned.ts';
import { startChatRoute } from './start.ts';
import { steerChatTurnRoute } from './steer.ts';
import { stopChatTurnRoute } from './stop.ts';
import { getChatToolRoute } from './tool-get.ts';
import { updateChatRoute } from './update.ts';
import { updateChatSystemPromptRoute } from './update-system-prompt.ts';
import { updateChatTabAppearanceRoute } from './update-tab-appearance.ts';

export const chatRouter = createRouter({
    approval: createRouter({
        respond: respondToChatApprovalRoute,
    }),
    archive: archiveChatRoute,
    clarification: createRouter({
        respond: respondToChatClarificationRoute,
    }),
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
    send: sendChatMessageRoute,
    setPinned: setChatPinnedRoute,
    start: startChatRoute,
    steer: steerChatTurnRoute,
    stop: stopChatTurnRoute,
    updateTabAppearance: updateChatTabAppearanceRoute,
    updateSystemPrompt: updateChatSystemPromptRoute,
    update: updateChatRoute,
});
