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

export function AgentDangerSection({
    agent,
    variant,
}: {
    agent: AgentListOutput['agents'][number];
    variant: 'page' | 'pane';
}) {
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
                    // Pane-hosted: closing the pane keeps the user in the
                    // conversation; only the Members page redirects.
                    closeAgentProfilePanesForAgent(agent.id);
                    if (variant === 'page') {
                        navigate(appRoutes.members, { replace: true });
                    }
                }}
                onOpenChange={setIsDeleteOpen}
                open={isDeleteOpen}
            />
        </SettingsSection>
    );
}
