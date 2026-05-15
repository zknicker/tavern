import * as React from 'react';
import { useSubAgentListSuspense } from '../../hooks/agents/use-sub-agent-list.ts';
import { buildSubAgentList } from './sub-agent-list-data.ts';
import { SubAgentsView } from './sub-agents-view.tsx';

export function Cortex() {
    const [subAgentData] = useSubAgentListSuspense();
    const subAgents = React.useMemo(
        () => buildSubAgentList(subAgentData.subAgents),
        [subAgentData.subAgents]
    );

    return <SubAgentsView subAgents={subAgents} />;
}
