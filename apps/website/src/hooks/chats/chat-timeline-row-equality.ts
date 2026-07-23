import type { ChatTimeline } from './chat-timeline-types.ts';

type MessageRow = Extract<ChatTimeline[number], { kind: 'message' }>;
type MessageThreadSummary = NonNullable<MessageRow['thread']>;
type MessageReactions = NonNullable<MessageRow['message']['reactions']>;
type MessageTask = NonNullable<MessageRow['message']['task']>;
type TaskActor = MessageTask['assignee'];

/**
 * Whether a refetched timeline is content-identical to the loaded one, so
 * snapshot application can keep the previous state object and let memoized
 * rows skip re-rendering. Row ids alone miss in-place row changes: a refetch
 * that only moves a message's thread summary, reactions, or task
 * (message.updated-only mutations) must not be swallowed as "same timeline".
 */
export function areSameTimeline(left: ChatTimeline, right: ChatTimeline) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((row, index) => {
        const other = right[index];

        if (!other || row.id !== other.id) {
            return false;
        }

        if (row.kind === 'message' && other.kind === 'message') {
            return areSameMessageAnnotations(row, other);
        }

        return true;
    });
}

function areSameMessageAnnotations(left: MessageRow, right: MessageRow) {
    return (
        isSameThreadSummary(left.thread ?? null, right.thread ?? null) &&
        areSameReactions(left.message.reactions ?? [], right.message.reactions ?? []) &&
        isSameTask(left.message.task ?? null, right.message.task ?? null)
    );
}

function isSameThreadSummary(
    left: MessageThreadSummary | null,
    right: MessageThreadSummary | null
) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.replyCount === right.replyCount &&
        left.unreadCount === right.unreadCount &&
        left.followed === right.followed &&
        left.latestReplyAt === right.latestReplyAt &&
        left.threadChatId === right.threadChatId
    );
}

function areSameReactions(left: MessageReactions, right: MessageReactions) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((reaction, index) => {
        const other = right[index];

        return (
            other !== undefined &&
            reaction.emoji === other.emoji &&
            reaction.actors.length === other.actors.length &&
            reaction.actors.every((actor, actorIndex) =>
                isSameTaskActor(actor, other.actors[actorIndex] ?? null)
            )
        );
    });
}

// Every task mutation bumps updated_at, so it alone catches status, assignee,
// claim, priority, and label-set changes; the rendered fields ride along as
// belt and braces.
function isSameTask(left: MessageTask | null, right: MessageTask | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.updated_at === right.updated_at &&
        left.number === right.number &&
        left.status === right.status &&
        isSameTaskActor(left.assignee, right.assignee)
    );
}

function isSameTaskActor(left: TaskActor, right: TaskActor) {
    if (left === right) {
        return true;
    }

    return Boolean(left && right && left.id === right.id && left.handle === right.handle);
}
