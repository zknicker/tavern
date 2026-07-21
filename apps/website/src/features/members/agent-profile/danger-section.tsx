import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { closeAgentProfilePanesForAgent } from '../../../hooks/pane/use-agent-profile-pane.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';
import { DeleteAgentDialog } from '../../agents/delete-agent-dialog.tsx';

export function AgentDangerSection({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const navigate = useNavigate();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    return (
        <SettingsSection title="Danger">
            <SettingsGroup>
                <SettingsRow
                    description="Remove this agent. This cannot be undone."
                    title="Delete agent"
                    trailingWidth="intrinsic"
                >
                    <Button onClick={() => setIsDeleteOpen(true)} variant="destructive-outline">
                        Delete agent
                    </Button>
                </SettingsRow>
            </SettingsGroup>
            <DeleteAgentDialog
                agent={agent}
                onDeleted={() => {
                    closeAgentProfilePanesForAgent(agent.id);
                    navigate(appRoutes.members, { replace: true });
                }}
                onOpenChange={setIsDeleteOpen}
                open={isDeleteOpen}
            />
        </SettingsSection>
    );
}
