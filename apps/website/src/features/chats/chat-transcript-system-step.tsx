import type { HugeiconsIconProps } from '@hugeicons/react';
import {
    BrainIcon,
    Message01Icon,
    PackageIcon,
    ToolsIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { AccessEventLogEntry } from '../sessions/log/event-entry/access-entry.tsx';
import { ArtifactLogEntry } from '../sessions/log/event-entry/artifact-entry.tsx';
import { DeliveryLogEntry } from '../sessions/log/event-entry/delivery-entry.tsx';
import { ThinkingLogEntry } from '../sessions/log/event-entry/thinking-entry.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { ThinkingStep, ThinkingStepDetails } from './thinking-steps.tsx';

type StepIcon = HugeiconsIconProps['icon'];

export function SystemStep({
    currentSessionKey,
    index,
    isLast,
    row,
}: {
    currentSessionKey?: string | null;
    index: number;
    isLast: boolean;
    row: Extract<TranscriptRow, { kind: 'system' }>;
}) {
    const body = getSystemBody({ currentSessionKey, row });
    const summary = getSystemSummary(row);

    return (
        <ThinkingStep
            description={summary.description}
            icon={summary.icon}
            index={index}
            isLast={isLast}
            label={summary.label}
        >
            {body ? <ThinkingStepDetails summary="Details">{body}</ThinkingStepDetails> : null}
        </ThinkingStep>
    );
}

function getSystemBody({
    currentSessionKey,
    row,
}: {
    currentSessionKey?: string | null;
    row: Extract<TranscriptRow, { kind: 'system' }>;
}) {
    switch (row.systemKind) {
        case 'accessEvent':
            return <AccessEventLogEntry entry={row} />;
        case 'artifact':
            return <ArtifactLogEntry entry={row} />;
        case 'delivery':
            return (
                <DeliveryLogEntry
                    currentSessionKey={currentSessionKey ?? row.delivery.parentSessionKey}
                    delivery={row.delivery}
                />
            );
        case 'thinking':
            return <ThinkingLogEntry entry={row} />;
    }
}

function getSystemSummary(row: Extract<TranscriptRow, { kind: 'system' }>): {
    description?: string;
    icon: StepIcon;
    label: string;
} {
    switch (row.systemKind) {
        case 'accessEvent':
            return { icon: ToolsIcon, label: 'Checked access' };
        case 'artifact':
            return { icon: PackageIcon, label: 'Captured artifact' };
        case 'delivery':
            return { icon: Message01Icon, label: 'Delivered update' };
        case 'thinking':
            return {
                description: row.thinking.text,
                icon: BrainIcon,
                label: 'Thought',
            };
    }
}
