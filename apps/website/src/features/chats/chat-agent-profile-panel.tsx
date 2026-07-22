import {
    closeAgentProfilePane,
    useAgentProfilePane,
} from '../../hooks/pane/use-agent-profile-pane.ts';
import { useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import { AgentProfile } from '../members/agent-profile/agent-profile.tsx';
import { ChatSidePaneShell } from './chat-side-pane-shell.tsx';

export function ChatAgentProfilePanel({ chatId }: { chatId: string }) {
    const agentId = useAgentProfilePane(chatId);
    const activeSidePane = useChatSidePane(chatId);

    return (
        <ChatSidePaneShell
            label="Agent profile"
            open={activeSidePane === 'profile' && agentId !== null}
        >
            {(width) =>
                agentId ? (
                    <div
                        className="flex h-full min-h-0 flex-col"
                        style={{ width: width ?? undefined }}
                    >
                        <AgentProfile
                            agentId={agentId}
                            hostChatId={chatId}
                            key={agentId}
                            onClose={() => closeAgentProfilePane(chatId)}
                            variant="pane"
                        />
                    </div>
                ) : null
            }
        </ChatSidePaneShell>
    );
}
