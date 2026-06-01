import { Add01Icon } from '@hugeicons-pro/core-duotone-rounded';
import { PlugIcon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Link } from 'react-router-dom';
import { AgentAvatar } from '../../components/ui/agent-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { usePrimaryAgentSuspense } from '../../hooks/agents/use-agent-list.ts';
import { useMessagingPlatformListSuspense } from '../../hooks/connections/use-messaging-platform-list.ts';
import { useOpenClawConfig } from '../../hooks/openclaw-config/use-openclaw-config.ts';
import { useSkillList } from '../../hooks/skills/use-skill-list.ts';
import type { AgentListOutput, MessagingPlatformListOutput } from '../../lib/trpc.tsx';
import { StartChatComposer } from '../chats/start-chat-composer.tsx';
import { DiscordIcon } from '../settings/connections/messaging-platform-discord-icon.tsx';
import { formatDiscordBindingInboundMode } from '../settings/connections/messaging-platform-shared.ts';
import { AgentCapabilities } from './agent-capabilities.tsx';
import { buildAgentPath, buildAgentSettingsPath } from './agent-path.ts';
import { AgentRecentChats } from './agent-recent-chats.tsx';
import { readAgentToolPolicyView } from './agent-tool-policy.ts';
import { MissingAgentState } from './missing-agent-state.tsx';

export function AgentHome() {
    const [primaryAgent] = usePrimaryAgentSuspense();
    const [messagingPlatformData] = useMessagingPlatformListSuspense();
    const openClawConfig = useOpenClawConfig();
    const skillQuery = useSkillList();
    const agent = primaryAgent.agent;

    if (!agent) {
        return <MissingAgentState agentId="primary" />;
    }

    const agentBindings = messagingPlatformData.bindings.filter(
        (binding) => binding.agentId === agent.id
    );
    const skills = skillQuery.data?.skills ?? [];
    const enabledSkills = skills.filter((skill) => agent.enabledSkillIds.includes(skill.id));
    const toolPolicy = readAgentToolPolicyView({
        agentId: agent.id,
        config: openClawConfig.data?.snapshot?.config,
    });

    return (
        <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 pt-12 pb-16 md:px-8 md:pt-16">
                <AgentHero agent={agent} />
                <AgentStartChat agent={agent} />
                <AgentChannels agent={agent} bindings={agentBindings} />
                <AgentCapabilities
                    agent={agent}
                    enabledSkills={enabledSkills}
                    skills={skills}
                    skillsError={skillQuery.error?.message ?? null}
                    skillsPending={skillQuery.isPending}
                    toolPolicy={toolPolicy}
                />
                <AgentRecentChats agent={agent} />
            </div>
        </div>
    );
}

function formatMessagingBindingTitle(binding: MessagingPlatformListOutput['bindings'][number]) {
    if (binding.platform.toLowerCase() === 'discord') {
        return 'Discord';
    }

    return sentenceCase(binding.platform);
}

function formatMessagingBindingDescription(
    binding: MessagingPlatformListOutput['bindings'][number]
) {
    const status = binding.enabled ? binding.status : 'disabled';

    if (binding.platform.toLowerCase() === 'discord') {
        return `${formatDiscordBindingInboundMode(binding.inboundMode)} · ${status}`;
    }

    return `${binding.name} · ${status}`;
}

function renderMessagingBindingIcon(binding: MessagingPlatformListOutput['bindings'][number]) {
    if (binding.platform.toLowerCase() === 'discord') {
        return (
            <span className="flex size-7 items-center justify-center rounded-md bg-[#5865F2]/10 text-[#5865F2]">
                <DiscordIcon className="size-4" />
            </span>
        );
    }

    return (
        <span className="flex size-7 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
            <Icon className="size-3.5" icon={PlugIcon} />
        </span>
    );
}

function AgentHero({ agent }: { agent: AgentListOutput['agents'][number] }) {
    return (
        <header className="flex flex-col gap-5">
            <AgentAvatar
                active
                avatar={agent.name}
                backgroundColor={agent.effectivePrimaryColor}
                className="size-14"
                name={agent.name}
            />
            <h1 className="max-w-[20ch] truncate font-semibold text-4xl text-foreground tracking-tight">
                {agent.name}
            </h1>
        </header>
    );
}

function AgentStartChat({ agent }: { agent: AgentListOutput['agents'][number] }) {
    return <StartChatComposer agent={agent} density="agent" />;
}

function AgentChannels({
    agent,
    bindings,
}: {
    agent: AgentListOutput['agents'][number];
    bindings: MessagingPlatformListOutput['bindings'];
}) {
    return (
        <section>
            <SectionLabel>Channels</SectionLabel>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <ChannelCard
                    description="Built-in direct chats"
                    icon={
                        <AgentAvatar
                            avatar={agent.name}
                            backgroundColor={agent.effectivePrimaryColor}
                            className="size-7"
                            name={agent.name}
                        />
                    }
                    title="Tavern chats"
                    to={buildAgentPath(agent.id)}
                />

                {bindings.map((binding) => (
                    <ChannelCard
                        description={formatMessagingBindingDescription(binding)}
                        icon={renderMessagingBindingIcon(binding)}
                        key={binding.id}
                        title={formatMessagingBindingTitle(binding)}
                        to={buildAgentSettingsPath(agent.id)}
                    />
                ))}

                <Link
                    className="group flex flex-col gap-3 rounded-xl border border-border border-dashed px-4 py-4 transition-colors hover:border-border-strong hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to={buildAgentSettingsPath(agent.id)}
                >
                    <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                        <Icon className="size-3.5" icon={Add01Icon} />
                    </span>
                    <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-sm">Add channel</p>
                        <p className="mt-1 truncate text-muted-foreground text-sm">
                            Use {agent.name} somewhere new
                        </p>
                    </div>
                </Link>
            </div>
        </section>
    );
}

function ChannelCard({
    description,
    icon,
    title,
    to,
}: {
    description: React.ReactNode;
    icon: React.ReactNode;
    title: React.ReactNode;
    to: string;
}) {
    return (
        <Link
            className="group flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={to}
        >
            <div className="shrink-0">{icon}</div>
            <div className="min-w-0">
                <p className="truncate font-medium text-foreground text-sm">{title}</p>
                <p className="mt-1 truncate text-muted-foreground text-sm">{description}</p>
            </div>
        </Link>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="font-medium text-muted-foreground text-sm">{children}</h2>;
}

function sentenceCase(value: string) {
    const normalized = value.trim();

    if (!normalized) {
        return 'Channel';
    }

    return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
}
