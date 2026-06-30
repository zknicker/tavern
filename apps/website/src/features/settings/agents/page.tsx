import { Navigate, useParams } from 'react-router-dom';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import { useModelList } from '../../../hooks/models/use-model-list.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import type { ModelListOutput } from '../../../lib/trpc.tsx';
import { buildAgentSettingsPath } from '../../agents/agent-path.ts';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { AgentGeneralSettingsContent, createAgentModelBaseline } from './general-content.tsx';

export { createNewAgentName, selectSettingsAgent } from './agent-settings-model.ts';

export function AgentSettingsPage() {
    const { agentId } = useParams();
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();

    if (agentsQuery.isPending || modelsQuery.isPending) {
        return <p className="text-muted-foreground text-sm">Loading agent settings...</p>;
    }

    const agents = agentsQuery.data?.agents ?? [];
    const agent = agentId
        ? (agents.find((candidate) => candidate.id === agentId) ?? null)
        : (agents[0] ?? null);

    if (!agent) {
        return agentId ? (
            <MissingAgentState agentId={agentId} />
        ) : (
            <p className="text-muted-foreground text-sm">No agents are available.</p>
        );
    }

    if (!agentId) {
        return <Navigate replace to={buildAgentSettingsPath(agent.id, 'general')} />;
    }

    const modelSetting = findAgentModelSetting(modelsQuery.data?.agents ?? [], agent.id);
    const nextAgent = agents.find((candidate) => candidate.id !== agent.id) ?? null;
    const deleteRedirectTo = nextAgent
        ? buildAgentSettingsPath(nextAgent.id, 'general')
        : appRoutes.settingsAgent;

    return (
        <AgentGeneralSettingsContent
            agent={agent}
            baseline={createAgentModelBaseline(modelSetting)}
            deleteRedirectTo={deleteRedirectTo}
            modelOptions={modelsQuery.data?.models ?? []}
            modelSetting={modelSetting ?? null}
        />
    );
}

function findAgentModelSetting(
    modelSettings: ModelListOutput['agents'],
    agentId: string
): ModelListOutput['agents'][number] | undefined {
    return modelSettings.find((entry) => entry.agentId === agentId);
}
