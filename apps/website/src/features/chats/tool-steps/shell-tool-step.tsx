import { CommandLineIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import {
    getToolFact,
    getToolTarget,
    InlineToolLabel,
    ToolDrawerTrigger,
    ToolTimelineStep,
} from './tool-summary.tsx';
import type { ToolStepRendererProps, ToolStepRow } from './types.ts';

export function ShellToolStep({ chatId, isLast, row }: ToolStepRendererProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const active = !(row.completedAt || hasErrorStatus(row.toolCall.status));
    const label = (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <InlineToolLabel row={row} target={getShellTarget(row)} verb={getShellVerb(row)} />
            <ToolDrawerTrigger chatId={chatId} isOpen={isOpen} onOpenChange={setIsOpen} row={row} />
        </span>
    );

    return (
        <ToolTimelineStep active={active} icon={CommandLineIcon} isLast={isLast} label={label} />
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
