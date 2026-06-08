import { DrawerPopup } from '../../../components/ui/drawer.tsx';
import { useChatTool } from '../../../hooks/chats/use-chat-tool.ts';
import { useSessionTool } from '../../../hooks/sessions/use-session-tool.ts';
import type { ChatToolOutput, SessionToolOutput } from '../../../lib/trpc.tsx';
import { ToolDrawerBody } from './tool-drawer-body.tsx';
import { ToolDrawerHeader } from './tool-drawer-header.tsx';

type ToolDrawerProps = { isOpen: boolean } & (
    | { activityId: string; chatId: string; source: 'chat' }
    | { sessionKey: string; source: 'session'; toolCallId: string }
);

export function ToolDrawer(props: ToolDrawerProps) {
    if (props.source === 'session') {
        return <SessionToolDrawer {...props} />;
    }

    return <ChatToolDrawer {...props} />;
}

function ChatToolDrawer({
    activityId,
    chatId,
    isOpen,
}: Extract<ToolDrawerProps, { source: 'chat' }>) {
    const toolQuery = useChatTool(
        {
            activityId,
            chatId,
        },
        {
            enabled: isOpen,
        }
    );
    const details: ChatToolOutput | null = toolQuery.data ?? null;

    return (
        <ToolDrawerShell
            details={details}
            isPending={toolQuery.isPending}
            queryError={!toolQuery.isPending && Boolean(toolQuery.error || !details)}
        />
    );
}

function SessionToolDrawer({
    isOpen,
    sessionKey,
    toolCallId,
}: Extract<ToolDrawerProps, { source: 'session' }>) {
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

    return (
        <ToolDrawerShell
            details={details}
            isPending={toolQuery.isPending}
            queryError={!toolQuery.isPending && Boolean(toolQuery.error || !details)}
        />
    );
}

function ToolDrawerShell({
    details,
    isPending,
    queryError,
}: {
    details: ChatToolOutput | SessionToolOutput | null;
    isPending: boolean;
    queryError: boolean;
}) {
    return (
        <DrawerPopup className="max-w-xl" showCloseButton variant="inset">
            {details ? (
                <ToolDrawerHeader
                    completedAt={details.completedAt}
                    startedAt={details.startedAt}
                    toolCall={details.toolCall}
                />
            ) : null}
            <ToolDrawerBody details={details} isPending={isPending} queryError={queryError} />
        </DrawerPopup>
    );
}
