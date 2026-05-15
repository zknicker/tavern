import type { HugeiconsIconProps } from '@hugeicons/react';
import {
    BrainIcon,
    BrowserIcon,
    CheckListIcon,
    Message01Icon,
    PuzzleIcon,
    TerminalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { workerKindConfig } from '../workers/config.ts';
import type { ActivityItem } from './chat-transcript-activity-utils.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { SystemStep } from './chat-transcript-system-step.tsx';
import { ToolStep } from './chat-transcript-tool-step.tsx';
import { ThinkingStep } from './thinking-steps.tsx';

type StepIcon = HugeiconsIconProps['icon'];

const progressStepIcon = {
    command: TerminalIcon,
    message: Message01Icon,
    plan: CheckListIcon,
    reasoning: BrainIcon,
    tool: BrowserIcon,
} satisfies Record<
    Extract<ActivityItem, { kind: 'activeProgress' }>['steps'][number]['kind'],
    StepIcon
>;

export function ActivityStep({
    currentSessionKey,
    index,
    isLast,
    item,
}: {
    currentSessionKey?: string | null;
    index: number;
    isLast: boolean;
    item: ActivityItem;
}) {
    if (item.kind === 'activeProgress') {
        return (
            <>
                {item.steps.map((step, stepIndex) => (
                    <ThinkingStep
                        description={step.detail}
                        icon={progressStepIcon[step.kind]}
                        index={index + stepIndex}
                        isLast={isLast && stepIndex === item.steps.length - 1}
                        key={step.id}
                        label={step.label}
                        status={step.status === 'completed' ? 'complete' : step.status}
                    />
                ))}
            </>
        );
    }

    switch (item.row.kind) {
        case 'tool':
            return <ToolStep index={index} isLast={isLast} row={item.row} />;
        case 'worker':
            return <WorkerStep index={index} isLast={isLast} row={item.row} />;
        case 'system':
            return (
                <SystemStep
                    currentSessionKey={currentSessionKey}
                    index={index}
                    isLast={isLast}
                    row={item.row}
                />
            );
        default:
            return null;
    }
}

function WorkerStep({
    index,
    isLast,
    row,
}: {
    index: number;
    isLast: boolean;
    row: Extract<TranscriptRow, { kind: 'worker' }>;
}) {
    const { openSession } = useSessionDrawer();
    const config = workerKindConfig[row.worker.kind];
    const relatedSessionKey = row.worker.childSessionKey ?? row.worker.sessionKey;

    return (
        <ThinkingStep
            description={row.worker.detail}
            icon={PuzzleIcon}
            index={index}
            isLast={isLast}
            label={
                <button
                    className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 text-left hover:text-foreground disabled:pointer-events-none"
                    disabled={!relatedSessionKey}
                    onClick={() => relatedSessionKey && openSession(relatedSessionKey)}
                    type="button"
                >
                    <span className="shrink-0">{config.label}</span>
                    <span className="truncate text-muted-foreground">{row.worker.title}</span>
                </button>
            }
            status={row.worker.status === 'failed' ? 'failed' : 'complete'}
        />
    );
}
