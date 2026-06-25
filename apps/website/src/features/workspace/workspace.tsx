import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { WorkspaceBrowserContent } from '../chats/chat-artifact-workspace-content.tsx';

export function Workspace() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const agent = primaryAgent.agent;

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    return (
        <WorkspaceBrowserContent
            agentId={agent.id}
            sidebarStorageKey="tavern.workspace.sidebar.width"
        />
    );
}
