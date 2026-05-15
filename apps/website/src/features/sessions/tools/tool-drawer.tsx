import { DrawerPopup } from '../../../components/ui/drawer.tsx';
import { useSessionTool } from '../../../hooks/sessions/use-session-tool.ts';
import type { SessionHistoryToolCallOutput, SessionToolOutput } from '../../../lib/trpc.tsx';
import { ToolDrawerBody } from './tool-drawer-body.tsx';
import { ToolDrawerHeader } from './tool-drawer-header.tsx';

export function ToolDrawer({
    completedAt,
    isOpen,
    sessionKey,
    startedAt,
    toolCall,
    toolCallId,
}: {
    completedAt: string | null;
    isOpen: boolean;
    sessionKey: string;
    startedAt: string | null;
    toolCall: SessionHistoryToolCallOutput;
    toolCallId: string;
}) {
    const toolQuery = useSessionTool(
        {
            sessionKey,
            toolCallId,
        },
        {
            enabled: isOpen,
        }
    );
    const details: SessionToolOutput | null = toolQuery.data ?? null;
    const resolvedToolCall = details?.toolCall ?? toolCall;
    const detailStartedAt = details?.startedAt ?? startedAt;
    const detailCompletedAt = details?.completedAt ?? completedAt;

    return (
        <DrawerPopup className="max-w-xl" showCloseButton variant="inset">
            <ToolDrawerHeader
                completedAt={detailCompletedAt}
                startedAt={detailStartedAt}
                toolCall={resolvedToolCall}
            />
            <ToolDrawerBody
                details={details}
                isPending={toolQuery.isPending}
                queryError={!toolQuery.isPending && Boolean(toolQuery.error || !details)}
            />
        </DrawerPopup>
    );
}
