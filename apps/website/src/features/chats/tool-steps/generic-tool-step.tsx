import type { HugeiconsIconProps } from '@hugeicons/react';
import {
    AiMagicIcon,
    BrowserIcon,
    FileEditIcon,
    FileSearchIcon,
    ToolsIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { SessionLinkButton } from '../../sessions/session-link-button.tsx';
import { getSessionRelationshipName } from '../../sessions/session-relationship.ts';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { ThinkingStepDetails } from '../thinking-steps.tsx';
import {
    getToolTarget,
    InlineToolLabel,
    ToolDrawerTrigger,
    ToolTimelineStep,
} from './tool-summary.tsx';
import type { ToolStepRendererProps } from './types.ts';

type StepIcon = HugeiconsIconProps['icon'];

export function GenericToolStep({ chatId, isLast, row }: ToolStepRendererProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const active = !(row.completedAt || hasErrorStatus(row.toolCall.status));
    const target = getToolTarget(row);
    const label = (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <InlineToolLabel row={row} target={target} verb={getToolVerb(row, target)} />
            <ToolDrawerTrigger chatId={chatId} isOpen={isOpen} onOpenChange={setIsOpen} row={row} />
        </span>
    );

    return (
        <ToolTimelineStep
            active={active}
            icon={getToolIcon(row.toolCall.name)}
            isLast={isLast}
            label={label}
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

function getToolIcon(name: string): StepIcon {
    const normalized = name.toLowerCase();

    if (isEditTool(normalized)) {
        return FileEditIcon;
    }

    if (matchesAny(normalized, ['read', 'grep', 'search', 'code'])) {
        return FileSearchIcon;
    }

    if (normalized.includes('skill')) {
        return AiMagicIcon;
    }

    if (matchesAny(normalized, ['browser', 'open', 'click'])) {
        return BrowserIcon;
    }

    return ToolsIcon;
}

function isEditTool(normalizedName: string) {
    return matchesAny(normalizedName, ['edit', 'write', 'patch', 'update']);
}

function matchesAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(needle));
}
