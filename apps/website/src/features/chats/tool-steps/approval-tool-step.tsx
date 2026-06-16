import { SecurityCheckIcon } from '@hugeicons-pro/core-stroke-rounded';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { getToolTarget, InlineToolLabel, ToolTimelineStep } from './tool-summary.tsx';
import type { ToolStepRendererProps } from './types.ts';

// Pending approvals still render as execution evidence in the work log. The
// response controls live in the chat footer so they do not crowd tool rows.
export function ApprovalToolStep({
    animateEnter,
    chatId,
    index,
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
            index={index}
            isLast={isLast}
            label={
                <InlineToolLabel
                    row={row}
                    target={target}
                    verb={isPending ? 'Needs approval' : 'Approval'}
                />
            }
            row={row}
        />
    );
}
