import { useNavigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';
import { EmptyState } from '../shell/empty-state.tsx';

export function MissingAgentState({ agentId }: { agentId: string }) {
    const navigate = useNavigate();

    return (
        <EmptyState
            actionLabel="Back to overview"
            description={`No agent named "${agentId}" was found.`}
            onAction={() => navigate(appRoutes.activity)}
            title="Agent not found"
        />
    );
}
