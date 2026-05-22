import { PuzzleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { workerKindConfig } from '../workers/config.ts';
import type { ActivityItem } from './chat-transcript-activity-utils.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { SystemStep } from './chat-transcript-system-step.tsx';
import { ToolStep } from './chat-transcript-tool-step.tsx';
import { ThinkingStep } from './thinking-steps.tsx';

export function ActivityStep({
    chatId,
    currentSessionKey,
    index,
    isLast,
    item,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    index: number;
    isLast: boolean;
    item: ActivityItem;
}) {
    switch (item.row.kind) {
        case 'tool':
            return <ToolStep chatId={chatId} index={index} isLast={isLast} row={item.row} />;
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
