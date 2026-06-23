export type ChatScrollAnchorSnapshot =
    | { atBottom: true }
    | { atBottom: false; offsetPx: number; rowId: string };

const chatScrollAnchors = new Map<string, ChatScrollAnchorSnapshot>();

export function readChatScrollAnchor(chatId: string | null | undefined) {
    if (!chatId) {
        return null;
    }

    return copyChatScrollAnchor(chatScrollAnchors.get(chatId) ?? null);
}

export function writeChatScrollAnchor(
    chatId: string | null | undefined,
    anchor: ChatScrollAnchorSnapshot | null
) {
    if (!chatId) {
        return;
    }

    if (!anchor) {
        chatScrollAnchors.delete(chatId);
        return;
    }

    chatScrollAnchors.set(chatId, copyRequiredChatScrollAnchor(anchor));
}

export function clearChatScrollAnchorsForTests() {
    chatScrollAnchors.clear();
}

function copyChatScrollAnchor(
    anchor: ChatScrollAnchorSnapshot | null
): ChatScrollAnchorSnapshot | null {
    if (!anchor) {
        return null;
    }

    return anchor.atBottom
        ? { atBottom: true }
        : { atBottom: false, offsetPx: anchor.offsetPx, rowId: anchor.rowId };
}

function copyRequiredChatScrollAnchor(anchor: ChatScrollAnchorSnapshot): ChatScrollAnchorSnapshot {
    return anchor.atBottom
        ? { atBottom: true }
        : { atBottom: false, offsetPx: anchor.offsetPx, rowId: anchor.rowId };
}
