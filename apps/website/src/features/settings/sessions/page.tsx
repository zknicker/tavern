import * as React from 'react';
import {
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { usePrimaryAgentSuspense } from '../../../hooks/agents/use-agent-list.ts';
import { AgentRecentChats } from '../../agents/agent-recent-chats.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';

export function SessionsSettings() {
    return (
        <React.Suspense fallback={null}>
            <SessionsSettingsContent />
        </React.Suspense>
    );
}

function SessionsSettingsContent() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    return (
        <SettingsPage>
            <SettingsPageHeader title="Sessions" />
            <SettingsSection
                description="Synced Tavern, system, and external chats."
                title="Sessions"
            >
                <AgentRecentChats agent={agent} />
            </SettingsSection>
        </SettingsPage>
    );
}
