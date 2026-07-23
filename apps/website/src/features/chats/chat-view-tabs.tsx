import { Attachment01Icon, BubbleChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';

const chatViewTabs = [
    { icon: BubbleChatIcon, label: 'Chat', value: 'chat' },
    { icon: Attachment01Icon, label: 'Files', value: 'files' },
] as const;

export type ChatViewTab = (typeof chatViewTabs)[number]['value'];

export function supportsChatViewTabs(chat: { conversationKind: string; type: string }) {
    return (
        chat.type === 'tavern' &&
        (chat.conversationKind === 'channel' || chat.conversationKind === 'direct')
    );
}

export function ChatViewTabs({
    onValueChange,
    value,
}: {
    onValueChange: (value: ChatViewTab) => void;
    value: ChatViewTab;
}) {
    return (
        <TabsSubtle
            className="h-9 shrink-0 gap-0 border-[var(--content-card-border)] border-b px-3"
            onValueChange={(nextValue) => onValueChange(nextValue as ChatViewTab)}
            value={value}
        >
            <TabsSubtleList aria-label="Chat views" className="h-full py-0" variant="underline">
                {chatViewTabs.map((tab) => (
                    <TabsSubtleItem
                        icon={tab.icon}
                        key={tab.value}
                        label={tab.label}
                        size="sm"
                        value={tab.value}
                    />
                ))}
            </TabsSubtleList>
        </TabsSubtle>
    );
}
