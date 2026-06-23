import { SessionLinkButton } from '../../sessions/session-link-button.tsx';
import { getSessionRelationshipName } from '../../sessions/session-relationship.ts';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { ThinkingStepDetails } from '../thinking-steps.tsx';
import { isEditTool, resolveToolStepIcon } from './tool-step-icons.ts';
import { getToolTarget, InlineToolLabel, ToolTimelineStep } from './tool-summary.tsx';
import type { ToolStepRendererProps } from './types.ts';

export function GenericToolStep({
    animateEnter,
    chatId,
    index,
    isLast,
    row,
}: ToolStepRendererProps) {
    const target = getToolTarget(row);
    const visibleTarget = hasErrorStatus(row.toolCall.status)
        ? getFailedToolTarget(row, target)
        : target;

    return (
        <ToolTimelineStep
            animateEnter={animateEnter}
            chatId={chatId}
            icon={resolveToolStepIcon(row.toolCall.name)}
            index={index}
            isLast={isLast}
            label={
                <InlineToolLabel
                    row={row}
                    target={visibleTarget}
                    verb={getToolVerb(row, visibleTarget)}
                />
            }
            row={row}
        >
            {row.spawnedRelationships.length > 0 ? (
                <ThinkingStepDetails
                    summary={`Spawned ${row.spawnedRelationships.length} ${
                        row.spawnedRelationships.length === 1 ? 'session' : 'sessions'
                    }`}
                >
                    <div className="flex flex-wrap gap-1.5">
                        {row.spawnedRelationships.map((relationship) => (
                            <SessionLinkButton
                                className="max-w-full px-2.5 py-1.5"
                                key={relationship.id}
                                label="Spawned Session"
                                sessionKey={relationship.relatedSession.key}
                                subtitle="Open related session"
                                title={getSessionRelationshipName(relationship)}
                                tone="sky"
                            />
                        ))}
                    </div>
                </ThinkingStepDetails>
            ) : null}
        </ToolTimelineStep>
    );
}

function getFailedToolTarget(row: ToolStepRendererProps['row'], target: string) {
    const toolName = row.toolCall.name.trim();

    if (!toolName) {
        return target;
    }

    const normalizedName = toolName.toLowerCase();
    const normalizedTarget = target.toLowerCase();

    if (
        normalizedTarget === normalizedName ||
        normalizedTarget.startsWith(`${normalizedName} `) ||
        normalizedTarget.startsWith(`${normalizedName}:`) ||
        normalizedTarget.startsWith(`${normalizedName} ·`)
    ) {
        return target;
    }

    return `${toolName} ${target}`;
}

function getToolVerb(row: ToolStepRendererProps['row'], target: string) {
    if (!(row.completedAt || hasErrorStatus(row.toolCall.status))) {
        return 'Using';
    }

    const normalized = row.toolCall.name.toLowerCase();
    const normalizedStatus = row.toolCall.status?.toLowerCase() ?? '';

    if (hasErrorStatus(row.toolCall.status)) {
        return normalizedStatus.includes('timeout') || normalizedStatus.includes('timed out')
            ? 'Timed out'
            : 'Failed';
    }

    if (target.toLowerCase().startsWith(normalized)) {
        return 'Used';
    }

    if (isEditTool(normalized)) {
        return 'Edited';
    }

    if (matchesAny(normalized, ['read', 'grep', 'search'])) {
        return 'Read';
    }

    if (normalized.includes('skill')) {
        return 'Used skill';
    }

    if (matchesAny(normalized, ['browser', 'open', 'click'])) {
        return 'Browsed';
    }

    return 'Used';
}

function matchesAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(needle));
}
