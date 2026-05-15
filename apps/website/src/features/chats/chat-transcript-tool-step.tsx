import type { HugeiconsIconProps } from '@hugeicons/react';
import {
    AiMagicIcon,
    BrowserIcon,
    CommandLineIcon,
    FileEditIcon,
    FileSearchIcon,
    ToolsIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Drawer, DrawerTrigger } from '../../components/ui/drawer.tsx';
import { cn } from '../../lib/utils.ts';
import { SessionLinkButton } from '../sessions/session-link-button.tsx';
import { getSessionRelationshipName } from '../sessions/session-relationship.ts';
import { ToolDrawer } from '../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../sessions/tools/tool-ui.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { ThinkingStep, ThinkingStepDetails } from './thinking-steps.tsx';

type StepIcon = HugeiconsIconProps['icon'];

export function ToolStep({
    index,
    isLast,
    row,
}: {
    index: number;
    isLast: boolean;
    row: Extract<TranscriptRow, { kind: 'tool' }>;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const toolCallId = row.toolCall.callId;
    const sessionKey = row.sessionKey;
    const canInspect = toolCallId !== null && sessionKey !== null;
    const hasError = hasErrorStatus(row.toolCall.status);
    const toolLabel = getToolLabel(row);
    const label = canInspect ? (
        <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
            <DrawerTrigger
                render={
                    <button
                        className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 text-left hover:text-foreground"
                        type="button"
                    />
                }
            >
                {toolLabel}
            </DrawerTrigger>
            <ToolDrawer
                completedAt={row.completedAt}
                isOpen={isOpen}
                sessionKey={sessionKey}
                startedAt={row.startedAt}
                toolCall={row.toolCall}
                toolCallId={toolCallId}
            />
        </Drawer>
    ) : (
        toolLabel
    );

    return (
        <ThinkingStep
            icon={getToolIcon(row.toolCall.name)}
            index={index}
            isLast={isLast}
            label={label}
            status={hasError ? 'failed' : 'complete'}
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
        </ThinkingStep>
    );
}

function getToolLabel(row: Extract<TranscriptRow, { kind: 'tool' }>) {
    const target =
        row.toolCall.summaryParts.join(' ') || row.toolCall.label || row.toolCall.name || 'tool';
    const duration = formatToolDuration(row.startedAt, row.completedAt);

    return (
        <span className="inline-flex min-w-0 max-w-full items-baseline gap-1.5">
            <span
                className={cn(
                    'shrink-0',
                    hasErrorStatus(row.toolCall.status) && 'text-destructive'
                )}
            >
                {getToolVerb(row.toolCall.name)}
            </span>
            <span className="truncate text-muted-foreground">{target}</span>
            {duration ? (
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                    {duration}
                </span>
            ) : null}
        </span>
    );
}

function getToolVerb(name: string) {
    const normalized = name.toLowerCase();

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

    if (matchesAny(normalized, ['exec', 'command', 'shell'])) {
        return 'Ran';
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

    if (matchesAny(normalized, ['exec', 'command', 'shell'])) {
        return CommandLineIcon;
    }

    return ToolsIcon;
}

function isEditTool(normalizedName: string) {
    return matchesAny(normalizedName, ['edit', 'write', 'patch', 'update']);
}

function matchesAny(value: string, needles: string[]) {
    return needles.some((needle) => value.includes(needle));
}
