import type { TranscriptItem, TranscriptRow } from './chat-transcript-model.ts';
import {
    isEditTool,
    resolveToolStepIcon,
    type ToolStepIcon,
} from './tool-steps/tool-step-icons.ts';

const commandToolNames = ['bash', 'command', 'exec', 'shell', 'terminal', 'zsh'];

type ActivityRow = Exclude<TranscriptRow, Extract<TranscriptRow, { kind: 'message' | 'widget' }>>;

export type ActivityItem = Extract<TranscriptItem, { kind: 'row' }> & {
    row: ActivityRow;
};

export function isActivityItem(item: TranscriptItem): item is ActivityItem {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return false;
    }

    if (item.kind === 'row' && item.row.kind === 'system' && item.row.systemKind === 'turnStatus') {
        return false;
    }

    return (
        item.kind !== 'row' ||
        (item.row.kind !== 'message' && item.row.kind !== 'widget' && !isNarrationToolRow(item.row))
    );
}

export function isAssistantNarrationItem(item: TranscriptItem): item is Extract<
    TranscriptItem,
    { kind: 'row' }
> & {
    row: Extract<TranscriptRow, { kind: 'tool' }>;
} {
    return item.kind === 'row' && isNarrationToolRow(item.row);
}

export function isActiveActivityItem(item: ActivityItem) {
    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return !item.row.completedAt;
    }

    return false;
}

export function getActivityStart(items: ActivityItem[]) {
    return items.map(getActivityStartTimestamp).find((timestamp) => timestamp !== null) ?? null;
}

export function getActivityEnd(items: ActivityItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const timestamp = getActivityEndTimestamp(items[index]);

        if (timestamp) {
            return timestamp;
        }
    }

    return null;
}

function getActivityStartTimestamp(item: ActivityItem | undefined): string | null {
    if (!item) {
        return null;
    }

    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return item.row.startedAt ?? item.row.completedAt;
    }

    if (item.row.kind === 'system') {
        return item.row.timestamp;
    }

    return null;
}

function getActivityEndTimestamp(item: ActivityItem | undefined): string | null {
    if (!item) {
        return null;
    }

    if (item.row.kind === 'tool' || item.row.kind === 'worker') {
        return item.row.completedAt;
    }

    if (item.row.kind === 'system') {
        return item.row.timestamp;
    }

    return null;
}

export function formatActivityHeader({
    end,
    isActive,
    now,
    start,
}: {
    end: string | null;
    isActive: boolean;
    now: number;
    start: string | null;
}) {
    const duration = formatElapsed(start, isActive ? now : end);

    if (!duration) {
        return isActive ? 'Working' : 'Worked';
    }

    return `${isActive ? 'Working' : 'Worked'} for ${duration}`;
}

export function formatActiveActivitySeconds({ now, start }: { now: number; start: string | null }) {
    if (!start) {
        return null;
    }

    const startMs = Date.parse(start);

    if (Number.isNaN(startMs)) {
        return null;
    }

    return `${Math.floor(Math.max(0, now - startMs) / 1000)}s`;
}

function formatElapsed(start: string | null, end: number | string | null) {
    if (!(start && end)) {
        return null;
    }

    const startMs = Date.parse(start);
    const endMs = typeof end === 'number' ? end : Date.parse(end);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return null;
    }

    const elapsedMs = Math.max(0, endMs - startMs);

    const totalSeconds = Math.max(1, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];

    if (hours > 0) {
        parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (minutes > 0) {
        parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (seconds > 0 || parts.length === 0) {
        parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return parts.join(' ');
}

export function getActivityItemKey(item: ActivityItem) {
    return item.row.id;
}

export function getAssistantNarrationText(item: TranscriptItem) {
    if (!isAssistantNarrationItem(item)) {
        return null;
    }

    const label = item.row.toolCall.label?.trim() ?? '';
    const parts = item.row.toolCall.summaryParts.map((part) => part.trim()).filter(Boolean);
    const [firstPart, ...remainingParts] = parts;
    const bodyParts =
        firstPart && isNarrationTitle(firstPart, label) && remainingParts.length > 0
            ? remainingParts
            : parts;
    const text = bodyParts.join('\n').trim() || label;

    return text.length > 0 ? text : null;
}

/**
 * Live label for a collapsed work group: what the agent is doing right now,
 * derived from the most recent still-running item.
 */
export function getActiveWorkLabel(items: ActivityItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (!(item && isActiveActivityItem(item))) {
            continue;
        }

        if (item.row.kind === 'tool') {
            const name = item.row.toolCall.name.trim();
            const normalizedName = name.toLowerCase();

            if (normalizedName === 'clarify') {
                return 'Needs an answer';
            }
            const target =
                item.row.toolCall.summaryParts.join(' ').trim() ||
                item.row.toolCall.label?.trim() ||
                name;
            const isCommand = matchesAny(normalizedName, commandToolNames);
            const isEdit = isEditTool(normalizedName);
            const verb = isCommand ? 'Running' : isEdit ? 'Editing' : 'Using';

            // A target that is just the tool's internal name is not intent;
            // fall back to plain product phrasing instead of "Running terminal".
            if (target.toLowerCase() === name.toLowerCase()) {
                if (isCommand) {
                    return 'Running a command';
                }

                return isEdit ? 'Editing a file' : `Using ${name}`;
            }

            return `${verb} ${target}`;
        }

        if (item.row.kind === 'worker' && item.row.worker.title) {
            return `Working on ${item.row.worker.title}`;
        }
    }

    return null;
}

/**
 * Count summary for a work group ("Ran 2 commands, searched web"), or
 * null when the group has nothing countable yet.
 */
export function formatWorkGroupSummary(items: ActivityItem[]) {
    const counts = countWorkItems(items);
    const parts = [
        formatActionCount(counts.toolUse + counts.other, 'Used', 'tool'),
        formatActionCount(counts.fileRead, 'Read', 'file'),
        formatTimes(counts.codeSearch, 'Searched code'),
        formatActionCount(counts.edit, 'Edited', 'file'),
        formatActionCount(counts.command, 'Ran', 'command'),
        formatTimes(counts.web, 'Searched web'),
    ].filter((part): part is string => Boolean(part));

    return parts.length > 0 ? joinHeaderParts(parts) : null;
}

export function formatWorkGroupHeader(items: ActivityItem[]) {
    const summary = formatWorkGroupSummary(items);

    if (summary) {
        return summary;
    }

    return countWorkItems(items).thinking > 0 ? 'Thinking' : 'Worked';
}

export function formatActiveWorkGroupHeader(items: ActivityItem[]) {
    const activeLabel = getActiveWorkLabel(items);

    if (activeLabel) {
        return activeLabel;
    }

    return countWorkItems(items).thinking > 0 ? 'Thinking' : 'Working';
}

/**
 * Icon for a collapsed work group header: the running tool's icon while
 * work executes, the shared icon when every tool resolves to one kind, and
 * the generic tools icon for mixed groups.
 */
export function getWorkGroupIcon(items: ActivityItem[]): ToolStepIcon | null {
    const toolNames = items.flatMap((item) =>
        item.row.kind === 'tool' && !isNarrationToolRow(item.row) ? [item.row.toolCall.name] : []
    );

    if (toolNames.length === 0) {
        return null;
    }

    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (item && isActiveActivityItem(item) && item.row.kind === 'tool') {
            return resolveToolStepIcon(item.row.toolCall.name);
        }
    }

    const icons = new Set(toolNames.map((name) => resolveToolStepIcon(name)));
    const [firstIcon] = icons;

    return icons.size === 1 && firstIcon ? firstIcon : resolveToolStepIcon('tool');
}

function isNarrationToolRow(row: TranscriptRow) {
    return row.kind === 'tool' && row.toolCall.name.trim().toLowerCase() === 'message';
}

function countWorkItems(items: ActivityItem[]) {
    return items.reduce(
        (counts, item) => {
            if (item.row.kind === 'system' && item.row.systemKind === 'thinking') {
                counts.thinking += 1;
                return counts;
            }

            if (item.row.kind !== 'tool') {
                counts.other += 1;
                return counts;
            }

            const name = item.row.toolCall.name.trim().toLowerCase();

            if (matchesAny(name, ['tool_search', 'tool-search'])) {
                counts.toolUse += 1;
                return counts;
            }

            if (name === 'clarify') {
                counts.other += 1;
                return counts;
            }

            if (isFileEditToolName(name)) {
                counts.edit += 1;
                return counts;
            }

            if (
                matchesAny(name, ['bash', 'command', 'exec', 'process', 'shell', 'terminal', 'zsh'])
            ) {
                counts.command += 1;
                return counts;
            }

            if (name.includes('web')) {
                counts.web += 1;
                return counts;
            }

            if (isCodeSearchToolName(name)) {
                counts.codeSearch += 1;
                return counts;
            }

            if (isFileReadToolName(name)) {
                counts.fileRead += 1;
                return counts;
            }

            counts.other += 1;
            return counts;
        },
        {
            codeSearch: 0,
            command: 0,
            edit: 0,
            fileRead: 0,
            other: 0,
            thinking: 0,
            toolUse: 0,
            web: 0,
        }
    );
}

function isFileEditToolName(normalizedName: string) {
    return (
        normalizedName === 'edit' ||
        normalizedName === 'write' ||
        matchesAny(normalizedName, [
            'apply_patch',
            'edit_file',
            'file_edit',
            'file_write',
            'patch',
            'replace',
            'write_file',
        ])
    );
}

function isCodeSearchToolName(normalizedName: string) {
    return (
        normalizedName === 'grep' ||
        normalizedName === 'search' ||
        normalizedName === 'rg' ||
        matchesAny(normalizedName, ['file_search', 'search_file'])
    );
}

function isFileReadToolName(normalizedName: string) {
    return normalizedName === 'read' || matchesAny(normalizedName, ['file_read', 'read_file']);
}

function formatActionCount(count: number, verb: string, noun: string) {
    if (count === 0) {
        return null;
    }

    if (count === 1) {
        return `${verb} a ${noun}`;
    }

    return `${verb} ${count} ${noun}s`;
}

function formatTimes(count: number, label: string) {
    if (count === 0) {
        return null;
    }

    return count === 1 ? label : `${label} ${count} times`;
}

function joinHeaderParts(parts: string[]) {
    return parts
        .map((part, index) => (index === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1)))
        .join(', ');
}

function isNarrationTitle(value: string, label: string) {
    const normalizedValue = value.trim().toLowerCase();
    const normalizedLabel = label.trim().toLowerCase();

    return (
        normalizedValue === 'assistant reply' ||
        normalizedValue === 'preamble' ||
        (normalizedLabel.length > 0 && normalizedValue === normalizedLabel)
    );
}

function matchesAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(needle));
}
