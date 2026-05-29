import * as React from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
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
        <div className="grid gap-6">
            <BadgeDivider subtext="Synced Tavern, system, and external chats.">
                Sessions
            </BadgeDivider>
            <AgentRecentChats agent={agent} />
        </div>
    );
}
