import { Tabs } from '../../components/ui/tabs.tsx';
import { useArtifactPaneWidth } from '../../hooks/pane/use-artifact-pane-width.ts';
import { useChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { ArtifactPanelChrome } from './chat-artifact-panel-chrome.tsx';
import { type ChatListItem, getChatAgentId } from './chat-list-data.ts';
import { getArtifactPanelTargetKey } from './tavern-resource-link.ts';

// The pane's chrome, hosted in the shell toolbar and sized to the pane below
// so tabs sit exactly over the pane they control (tabs layout only).
export function ChatArtifactToolbarTabs({ chat }: { chat: ChatListItem }) {
    const state = useChatArtifactPanelState(chat.id);
    const { width } = useArtifactPaneWidth();

    if (!state.visible) {
        return null;
    }

    return (
        <div
            className="-mr-2 flex shrink-0 items-center self-stretch border-border/60 border-l pl-1"
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
                    onClose={state.toggleVisible}
                    onCloseTarget={state.closeTarget}
                    onOpenTarget={state.open}
                    targets={state.targets}
                />
            </Tabs>
        </div>
    );
}
