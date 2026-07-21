import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useAgentListSuspense } from '../../../hooks/agents/use-agent-list.ts';
import { useMessagingPlatformList } from '../../../hooks/connections/use-messaging-platform-list.ts';
import { appRoutes } from '../../../lib/app-routes.ts';
import type { MessagingPlatformListOutput } from '../../../lib/trpc.tsx';
import { MissingAgentState } from '../../agents/missing-agent-state.tsx';
import { formatDiscordBindingInboundMode } from '../connections/messaging-platform-shared.ts';

export function ChannelsSettingsPage() {
    const { agentId } = useParams();
    const [agentList] = useAgentListSuspense();
    const bindingsQuery = useMessagingPlatformList();
    const agent = agentId
        ? (agentList.agents.find((candidate) => candidate.id === agentId) ?? null)
        : (agentList.agents[0] ?? null);

    if (!agent) {
        return <MissingAgentState agentId={agentId ?? 'primary'} />;
    }

    const bindings =
        bindingsQuery.data?.bindings.filter((binding) => binding.agentId === agent.id) ?? [];

    return (
        <SettingsPage>
            <SettingsPageHeader title="Channels" />
            <SettingsSection title="Channels">
                <SettingsGroup>
                    <SettingsRow
                        description="Built-in Grotto chat frontend"
                        title="Grotto"
                        trailingWidth="intrinsic"
                    >
                        <Button render={<Link to={appRoutes.chats} />} variant="outline">
                            Open chats
                        </Button>
                    </SettingsRow>
                    <Separator />

                    {bindings.length === 0 ? (
                        <p className="px-5 py-4 text-muted-foreground text-sm">
                            {bindingsQuery.isPending
                                ? 'Loading channels...'
                                : 'No external channels are connected.'}
                        </p>
                    ) : null}

                    {bindings.map((binding) => (
                        <Fragment key={binding.id}>
                            <SettingsRow
                                description={formatChannelDescription(binding)}
                                title={formatChannelTitle(binding)}
                                trailingWidth="intrinsic"
                            >
                                <span className="rounded-sm bg-muted px-2 py-1 text-muted-foreground text-xs">
                                    {binding.enabled ? binding.status : 'disabled'}
                                </span>
                            </SettingsRow>
                            <Separator />
                        </Fragment>
                    ))}
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function formatChannelTitle(binding: MessagingPlatformListOutput['bindings'][number]) {
    if (binding.platform.toLowerCase() === 'discord') {
        return 'Discord';
    }

    return binding.platform.charAt(0).toUpperCase() + binding.platform.slice(1);
}

function formatChannelDescription(binding: MessagingPlatformListOutput['bindings'][number]) {
    if (binding.platform.toLowerCase() === 'discord') {
        return `${formatDiscordBindingInboundMode(binding.inboundMode)} · ${binding.name}`;
    }

    return binding.name;
}
