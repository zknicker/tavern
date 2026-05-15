import { createRouter } from '../trpc.ts';
import { archiveChatRoute } from './archive.ts';
import { createChatRoute } from './create.ts';
import { listChatsRoute } from './list.ts';
import { listChatLogRoute } from './log-list.ts';
import { onChatTurnCompleted } from './on-turn-completed.ts';
import { onChatTurnFailed } from './on-turn-failed.ts';
import { onChatTurnProgress } from './on-turn-progress.ts';
import { onChatTurnReplyUpdated } from './on-turn-reply-updated.ts';
import { onChatTurnStarted } from './on-turn-started.ts';
import { sendChatMessageRoute } from './send.ts';
import { startChatRoute } from './start.ts';
import { listChatStatusesRoute } from './status-list.ts';
import { updateChatRoute } from './update.ts';

export const chatRouter = createRouter({
    archive: archiveChatRoute,
    create: createChatRoute,
    status: createRouter({
        list: listChatStatusesRoute,
    }),
    list: listChatsRoute,
    log: createRouter({
        list: listChatLogRoute,
    }),
    onTurnCompleted: onChatTurnCompleted,
    onTurnFailed: onChatTurnFailed,
    onTurnProgress: onChatTurnProgress,
    onTurnReplyUpdated: onChatTurnReplyUpdated,
    onTurnStarted: onChatTurnStarted,
    send: sendChatMessageRoute,
    start: startChatRoute,
    update: updateChatRoute,
});
