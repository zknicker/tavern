import {
    Drawer,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../components/ui/drawer.tsx';
import { useAgentAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useSessionDrawer } from '../../hooks/sessions/use-session-drawer.ts';
import { SessionCardBody } from './session-card-body.tsx';
import { SessionCardMetadata } from './session-card-metadata.tsx';
import { SessionDrawerDetails } from './session-drawer-details.tsx';
import { SessionDrawerHeader } from './session-drawer-header.tsx';
import { useSessionCard } from './use-session-card.ts';

export function SessionDrawerHost() {
    const { closeSession, isOpen, sessionKey } = useSessionDrawer();
    const agentsQuery = useAgentList();
    const agents = agentsQuery.data?.agents ?? [];
    const avatarDirectory = useAgentAvatarDirectory(agents);
    const { parentRelationship, sessionError, sessionMetadata, sessionHistoryQuery } =
        useSessionCard(sessionKey);

    const rows = sessionHistoryQuery.data?.rows ?? [];
    const totalRows = sessionHistoryQuery.data?.total ?? 0;
    const sessionMissing = sessionHistoryQuery.isSuccess && !sessionMetadata;
    const agentName =
        agents.find((agent) => agent.id === sessionMetadata?.agentId)?.name ??
        sessionMetadata?.agentId ??
        'Session';

    return (
        <Drawer
            onOpenChange={(nextOpen) => (nextOpen ? undefined : closeSession())}
            open={isOpen}
            position="right"
        >
            <DrawerPopup className="max-w-[min(96vw,42rem)]" showCloseButton variant="inset">
                {sessionMetadata ? (
                    <SessionDrawerHeader
                        agentName={agentName}
                        avatarDirectory={avatarDirectory}
                        session={{
                            agentId: sessionMetadata.agentId,
                            name: sessionMetadata.name,
                            platform: sessionMetadata.platform,
                            startedAt: sessionMetadata.startedAt,
                            source: sessionMetadata.source,
                            title: sessionMetadata.title,
                            type: sessionMetadata.type,
                        }}
                        sessionKey={sessionKey ?? ''}
                    />
                ) : sessionKey ? (
                    <SessionDrawerFallbackHeader sessionKey={sessionKey} />
                ) : null}
                <DrawerPanel className="flex min-h-0 flex-1 flex-col p-0" scrollable={false}>
                    {sessionMetadata ? (
                        <SessionDrawerDetails
                            session={{
                                id: sessionMetadata.id,
                                parentSessionKey: sessionMetadata.parentSessionKey,
                                platform: sessionMetadata.platform,
                                sessionKey: sessionKey ?? '',
                                source: sessionMetadata.source,
                            }}
                        />
                    ) : null}
                    {sessionMetadata ? (
                        <SessionCardMetadata
                            agentName={agentName}
                            duration={sessionMetadata.duration}
                            parentRelationship={parentRelationship}
                            showToolSummary={false}
                            title={sessionMetadata.source}
                            toolCalls={sessionMetadata.toolCalls}
                        />
                    ) : null}
                    <SessionCardBody
                        currentSessionKey={sessionKey ?? ''}
                        error={Boolean(sessionError) || sessionMissing}
                        isPending={sessionHistoryQuery.isPending}
                        rows={rows}
                        totalRows={totalRows}
                    />
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}

function SessionDrawerFallbackHeader({ sessionKey }: { sessionKey: string }) {
    return (
        <DrawerHeader>
            <DrawerTitle>Session logs</DrawerTitle>
            <p className="truncate font-mono text-muted-foreground text-sm">{sessionKey}</p>
        </DrawerHeader>
    );
}
