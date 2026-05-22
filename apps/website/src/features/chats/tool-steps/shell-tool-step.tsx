import { CommandLineIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { ThinkingStep } from '../thinking-steps.tsx';
import { getToolFact, getToolTarget, InlineToolLabel, ToolDrawerLabel } from './tool-summary.tsx';
import type { ToolStepRendererProps, ToolStepRow } from './types.ts';

export function ShellToolStep({ animate, chatId, index, isLast, row }: ToolStepRendererProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const hasError = hasErrorStatus(row.toolCall.status);
    const label = (
        <ToolDrawerLabel chatId={chatId} isOpen={isOpen} onOpenChange={setIsOpen} row={row}>
            <InlineToolLabel row={row} target={getShellTarget(row)} verb={getShellVerb(row)} />
        </ToolDrawerLabel>
    );

    return (
        <ThinkingStep
            animate={animate}
            icon={CommandLineIcon}
            index={index}
            isLast={isLast}
            label={label}
            status={hasError ? 'failed' : row.completedAt ? 'complete' : 'active'}
        />
    );
}

function getShellVerb(row: ToolStepRow) {
    const status = row.toolCall.status;

    const normalizedStatus = status?.toLowerCase() ?? '';

    if (normalizedStatus.includes('timeout') || normalizedStatus.includes('timed out')) {
        return 'Timed out';
    }

    if (hasErrorStatus(status)) {
        return 'Failed';
    }

    return row.completedAt ? 'Used' : 'Using';
}

function getShellTarget(row: ToolStepRow) {
    return getToolFact(row, 'Command') ?? getToolTarget(row);
}
