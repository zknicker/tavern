import { Tabs } from '../../components/ui/tabs.tsx';
import { useArtifactPaneWidth } from '../../hooks/pane/use-artifact-pane-width.ts';
import { useChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';
import { ChatPaneToggleButton } from './chat-pane-toggle-button.tsx';
import { getArtifactPanelTargetKey } from './tavern-resource-link.ts';

// The pane's chrome, hosted in the shell toolbar and sized to the pane below
// so tabs sit exactly over the pane they control (tabs layout only). The
// pane toggle stays the right-most toolbar control in both states so it
// never moves when the pane it governs opens or closes.
export function ChatArtifactToolbarTabs({ chat }: { chat: ChatListItem }) {
    const state = useChatArtifactPanelState(chat.id);
    const { width } = useArtifactPaneWidth();

    if (!state.visible) {
        return (
            <>
                <div aria-hidden="true" className="mx-1.5 h-4 w-px bg-border/60" />
                <ChatPaneToggleButton chatId={chat.id} />
            </>
        );
    }

    return (
        <div
            className="-mr-2 flex shrink-0 items-center self-stretch border-border/60 border-l pr-2 pl-1"
            style={{ width }}
        >
            <Tabs
                className="flex h-full min-w-0 flex-1 items-center"
                onValueChange={state.setActiveKey}
                value={state.activeKey ?? undefined}
            >
                <ArtifactPanelChrome
                    activeKey={state.activeKey}
                    activeTarget={state.targets.find(
                        (target) => getArtifactPanelTargetKey(target) === state.activeKey
                    )}
                    agentId={getChatAgentId(chat)}
                    className="h-full px-2"
                    closeButtonHidden
                    onClose={state.toggleVisible}
                    onCloseTarget={state.closeTarget}
                    onOpenTarget={state.open}
                    targets={state.targets}
                />
            </Tabs>
            <ChatPaneToggleButton chatId={chat.id} />
        </div>
    );
}
