import {
    Activity01Icon,
    BubbleChatIcon,
    Folder01Icon,
    Notification03Icon,
    PuzzleIcon,
    UserCircleIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useState } from 'react';
import {
    TabsSubtle,
    TabsSubtleItem,
    TabsSubtleList,
    TabsSubtlePanel,
} from '../../../components/ui/tabs-subtle.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { AgentActivityTab } from './activity-tab.tsx';
import { AgentProfileHeader } from './agent-profile-header.tsx';
import { AgentAppsTab } from './apps-tab.tsx';
import { AgentChatTab } from './chat-tab.tsx';
import { AgentProfileTab } from './profile-tab.tsx';
import { AgentRemindersTab } from './reminders-tab.tsx';
import { AgentWorkspaceTab } from './workspace-tab.tsx';

const tabs = [
    { icon: UserCircleIcon, label: 'Profile', value: 'profile' },
    { icon: Activity01Icon, label: 'Activity', value: 'activity' },
    { icon: BubbleChatIcon, label: 'Chat', value: 'chat' },
    { icon: Notification03Icon, label: 'Reminders', value: 'reminders' },
    { icon: Folder01Icon, label: 'Workspace', value: 'workspace' },
    { icon: PuzzleIcon, label: 'Apps', value: 'apps' },
] as const;

type AgentProfileTabId = (typeof tabs)[number]['value'];

export function AgentProfile({
    agentId,
    hostChatId,
    onClose,
    variant,
}: {
    agentId: string;
    hostChatId?: string;
    onClose?: () => void;
    variant: 'page' | 'pane';
}) {
    const agentsQuery = useAgentList();
    const agent = agentsQuery.data?.agents.find((candidate) => candidate.id === agentId) ?? null;
    const [activeTab, setActiveTab] = useState<AgentProfileTabId>('profile');

    if (agentsQuery.isPending) {
        return <p className="p-6 text-muted-foreground text-sm">Loading agent profile...</p>;
    }
    if (!agent) {
        return <p className="p-6 text-muted-foreground text-sm">Member not found.</p>;
    }

    return (
        <TabsSubtle
            className="h-full min-h-0 w-full gap-0"
            onValueChange={(value) => setActiveTab(value as AgentProfileTabId)}
            value={activeTab}
        >
            <AgentProfileHeader
                agent={agent}
                hostChatId={hostChatId}
                onClose={onClose}
                variant={variant}
            />
            <div
                className={cn(
                    'shrink-0 border-[var(--content-card-border)] border-b',
                    variant === 'page' ? 'px-5' : 'px-3'
                )}
            >
                <TabsSubtleList className="max-w-full overflow-x-auto" variant="underline">
                    {tabs.map((tab) => (
                        <TabsSubtleItem
                            icon={tab.icon}
                            key={tab.value}
                            label={tab.label}
                            size="sm"
                            value={tab.value}
                        />
                    ))}
                </TabsSubtleList>
            </div>
            <TabsSubtlePanel
                className={cn(
                    'min-h-0',
                    activeTab === 'workspace' ? 'overflow-hidden' : 'overflow-y-auto px-3'
                )}
                value={activeTab}
            >
                <ActiveTab agent={agent} tab={activeTab} />
            </TabsSubtlePanel>
        </TabsSubtle>
    );
}

function ActiveTab({
    agent,
    tab,
}: {
    agent: AgentListOutput['agents'][number];
    tab: AgentProfileTabId;
}) {
    switch (tab) {
        case 'profile':
            return <AgentProfileTab agent={agent} />;
        case 'activity':
            return <AgentActivityTab agentId={agent.id} />;
        case 'chat':
            return <AgentChatTab agentId={agent.id} />;
        case 'reminders':
            return <AgentRemindersTab agentId={agent.id} />;
        case 'workspace':
            return <AgentWorkspaceTab agentId={agent.id} />;
        case 'apps':
            return <AgentAppsTab agent={agent} />;
    }
}
