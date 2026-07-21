import { createRouter } from '../trpc.ts';
import { archiveChatRoute } from './archive.ts';
import { clearChatRoute } from './clear.ts';
import { createChatRoute } from './create.ts';
import { listChatFilesRoute } from './files-list.ts';
import { getChatRoute } from './get.ts';
import { listArchivedChatsRoute, listChatsRoute } from './list.ts';
import { dismissChatLogRowRoute } from './log-dismiss.ts';
import { listChatLogRoute } from './log-list.ts';
import { onChatLogUpdate } from './log-on-update.ts';
import { markChatReadRoute } from './mark-read.ts';
import { onChatTurnCancelled } from './on-turn-cancelled.ts';
import { onChatTurnCompleted } from './on-turn-completed.ts';
import { onChatTurnFailed } from './on-turn-failed.ts';
import { onChatTurnProgress } from './on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './on-turn-reply-updated.ts';
import { onChatTurnStarted } from './on-turn-started.ts';
import { onChatTurnStatusUpdated } from './on-turn-status-updated.ts';
import { onChatUpdate } from './on-update.ts';
import { sendChatMessageRoute } from './send.ts';
import { startChatRoute } from './start.ts';
import { stopChatTurnRoute } from './stop.ts';
import { getChatToolRoute } from './tool-get.ts';
import { getChatTurnEvidenceRoute } from './turn-evidence-get.ts';
import { getChatTurnFileChangesRoute } from './turn-file-changes-get.ts';
import { getChatTurnPromptRoute } from './turn-prompt-get.ts';
import { unarchiveChatRoute } from './unarchive.ts';
import { updateChatRoute } from './update.ts';
import { updateChatSystemPromptRoute } from './update-system-prompt.ts';
import { updateChatTabAppearanceRoute } from './update-tab-appearance.ts';

export const chatRouter = createRouter({
    archive: archiveChatRoute,
    clear: clearChatRoute,
    create: createChatRoute,
    files: createRouter({
        list: listChatFilesRoute,
    }),
    get: getChatRoute,
    tool: createRouter({
        get: getChatToolRoute,
    }),
    turn: createRouter({
        evidence: getChatTurnEvidenceRoute,
        fileChanges: getChatTurnFileChangesRoute,
    }),
    turnPrompt: createRouter({
        get: getChatTurnPromptRoute,
    }),
    list: listChatsRoute,
    listArchived: listArchivedChatsRoute,
    log: createRouter({
        dismiss: dismissChatLogRowRoute,
        list: listChatLogRoute,
        onUpdate: onChatLogUpdate,
    }),
    markRead: markChatReadRoute,
    onUpdate: onChatUpdate,
    onTurnCancelled: onChatTurnCancelled,
    onTurnCompleted: onChatTurnCompleted,
    onTurnFailed: onChatTurnFailed,
    onTurnProgress: onChatTurnProgress,
    onTurnReplyUpdated: onChatTurnReplyUpdated,
    onTurnStarted: onChatTurnStarted,
    onTurnStatusUpdated: onChatTurnStatusUpdated,
    send: sendChatMessageRoute,
    start: startChatRoute,
    stop: stopChatTurnRoute,
    unarchive: unarchiveChatRoute,
    updateTabAppearance: updateChatTabAppearanceRoute,
    updateSystemPrompt: updateChatSystemPromptRoute,
    update: updateChatRoute,
});
