import { SecurityCheckIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { getToolTarget, InlineToolLabel, ToolTimelineStep } from './tool-summary.tsx';
import type { ToolStepRendererProps } from './types.ts';

// A pending tool approval blocks the turn until answered, so the row carries
// inline Approve/Deny actions. The runtime settles the row once the agent
// resumes; until then the running shimmer marks the wait.
export function ApprovalToolStep({
    animateEnter,
    canRespondToApproval = false,
    chatId,
    isLast,
    row,
}: ToolStepRendererProps) {
    const target = getToolTarget(row);
    const isPending = !(row.completedAt || hasErrorStatus(row.toolCall.status));

    return (
        <ToolTimelineStep
            animateEnter={animateEnter}
            chatId={chatId}
            icon={SecurityCheckIcon}
            isLast={isLast}
            label={
                <InlineToolLabel
                    row={row}
                    target={target}
                    verb={isPending ? 'Needs approval' : 'Approval'}
                />
            }
            row={row}
        >
            {isPending && canRespondToApproval && chatId && row.sessionKey ? (
                <ApprovalActions chatId={chatId} sessionKey={row.sessionKey} />
            ) : null}
        </ToolTimelineStep>
    );
}

function ApprovalActions({ chatId, sessionKey }: { chatId: string; sessionKey: string }) {
    const respond = trpc.chat.approval.respond.useMutation();
    const [answer, setAnswer] = React.useState<'approved' | 'denied' | null>(null);

    const send = (choice: 'deny' | 'once') => {
        setAnswer(choice === 'once' ? 'approved' : 'denied');
        respond.mutate({ chatId, choice, sessionKey }, { onError: () => setAnswer(null) });
    };

    if (answer && !respond.isError) {
        return (
            <p className="pt-1 pb-1.5 text-meta text-muted-foreground">
                {answer === 'approved' ? 'Approved.' : 'Denied.'}
            </p>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1.5">
            <Button disabled={respond.isPending} onClick={() => send('once')} size="xs">
                Approve
            </Button>
            <Button
                disabled={respond.isPending}
                onClick={() => send('deny')}
                size="xs"
                variant="secondary"
            >
                Deny
            </Button>
            {respond.isError ? (
                <span className="text-destructive text-meta">Could not send the response.</span>
            ) : null}
        </div>
    );
}
