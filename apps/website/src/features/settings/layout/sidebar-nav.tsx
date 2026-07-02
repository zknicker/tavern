import { Plus } from '@hugeicons/core-free-icons';
import { ArrowLeft02Icon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../../components/ui/collapsible.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '../../../components/ui/sidebar.tsx';
import { useAgentList } from '../../../hooks/agents/use-agent-list.ts';
import {
    type CapabilityRequirement,
    type CapabilityView,
    formatCapabilityDisabledReason,
    settingsCapabilityRequirements,
    useCapability,
} from '../../../hooks/connections/use-capability.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, trpc } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { resolveAgentInk } from '../../agents/agent-color-presets.ts';
import { buildAgentSettingsPath, getActiveAgentPage } from '../../agents/agent-path.ts';
import { AgentFace } from '../../chats/agent-face.tsx';
import { createNewAgentName } from '../agents/agent-settings-model.ts';
import {
    agentSettingsNavItems,
    resolveAgentSettingsNavOpen,
    settingsNavSections,
    staticSettingsNavItems,
} from './navigation.ts';

// Matches the chat sidebar avatar treatment: a 20px slot with a 24px face
// (natural 480 divisor, slight overhang), inline width/height so the menu
// button's `[&_svg]:size-4.5` rule cannot resize it.
const faceStyle = { flexShrink: 0, height: 24, overflow: 'visible', width: 24 } as const;

type ResolveCapability = (requirement: CapabilityRequirement) => CapabilityView;
type StaticSettingsNavItem = (typeof staticSettingsNavItems)[number];
type SettingsNavSection = (typeof settingsNavSections)[number];

const staticSettingsNavItemsById = new Map<StaticSettingsNavItem['id'], StaticSettingsNavItem>(
    staticSettingsNavItems.map((item) => [item.id, item])
);
const settingsNavSectionsById = new Map<SettingsNavSection['id'], SettingsNavSection>(
    settingsNavSections.map((section) => [section.id, section])
);

export function SettingsSidebarNav({ onBackToApp }: { onBackToApp?: () => void }) {
    const capability = useCapability();
    const utils = trpc.useUtils();
    const prefetchModelsSettings = React.useCallback(() => {
        void import('../../../routes/app/settings-models-page.tsx');
        void utils.model.inventory.prefetch(undefined, queryPolicy.runtimeModelSnapshot);
    }, [utils]);
    const generalSection = settingsNavSectionsById.get('general');
    const activitySection = settingsNavSectionsById.get('activity');

    return (
        <>
            {onBackToApp ? <BackToAppSection onBackToApp={onBackToApp} /> : null}
            <StaticSettingsSection
                capability={capability}
                itemIds={generalSection?.itemIds ?? []}
                label={generalSection?.label ?? 'General'}
                prefetchModelsSettings={prefetchModelsSettings}
            />
            <AgentsSettingsSection capability={capability} />
            <StaticSettingsSection
                capability={capability}
                itemIds={activitySection?.itemIds ?? []}
                label={activitySection?.label ?? 'Activity'}
                prefetchModelsSettings={prefetchModelsSettings}
            />
        </>
    );
}

function BackToAppSection({ onBackToApp }: { onBackToApp: () => void }) {
    return (
        <SidebarGroup className="pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton className="text-sidebar-muted" onClick={onBackToApp}>
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={ArrowLeft02Icon}
                                size={18}
                            />
                            <span className="min-w-0 truncate">Back to app</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function StaticSettingsSection({
    capability,
    itemIds,
    label,
    prefetchModelsSettings,
}: {
    capability: ResolveCapability;
    itemIds: readonly StaticSettingsNavItem['id'][];
    label: string;
    prefetchModelsSettings: () => void;
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {itemIds.map((itemId) => {
                        const item = staticSettingsNavItemsById.get(itemId);

                        if (!item) {
                            return null;
                        }

                        return (
                            <StaticSettingsNavRow
                                capability={capability}
                                item={item}
                                key={item.id}
                                prefetchModelsSettings={prefetchModelsSettings}
                            />
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function StaticSettingsNavRow({
    capability,
    item,
    prefetchModelsSettings,
}: {
    capability: ResolveCapability;
    item: StaticSettingsNavItem;
    prefetchModelsSettings: () => void;
}) {
    const gate = capability(settingsCapabilityRequirements[item.id]);
    const disabledReason = gate.healthy ? null : formatCapabilityDisabledReason(gate);

    return (
        <SidebarMenuItem>
            {gate.healthy ? (
                <NavLink className="contents" to={item.to}>
                    {({ isActive }) => (
                        <SidebarMenuButton
                            isActive={isActive}
                            onFocus={item.id === 'models' ? prefetchModelsSettings : undefined}
                            onPointerEnter={
                                item.id === 'models' ? prefetchModelsSettings : undefined
                            }
                            render={<div />}
                        >
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={item.icon}
                                size={18}
                            />
                            <span className="min-w-0 truncate">{item.label}</span>
                        </SidebarMenuButton>
                    )}
                </NavLink>
            ) : (
                <SidebarMenuButton
                    className="w-fit max-w-full"
                    disabled
                    isActive={false}
                    tooltip={disabledReason ?? item.label}
                >
                    <Icon aria-hidden="true" className="shrink-0" icon={item.icon} size={18} />
                    <span className="min-w-0 truncate">{item.label}</span>
                </SidebarMenuButton>
            )}
        </SidebarMenuItem>
    );
}

function AgentsSettingsSection({ capability }: { capability: ResolveCapability }) {
    const agentsQuery = useAgentList();
    const navigate = useNavigate();
    const utils = trpc.useUtils();
    const agents = agentsQuery.data?.agents ?? [];
    const createAgent = trpc.agent.create.useMutation({
        onSuccess: async ({ agent }) => {
            await Promise.all([
                utils.agent.list.invalidate(),
                utils.agent.primary.invalidate(),
                utils.model.list.invalidate(),
            ]);
            navigate(buildAgentSettingsPath(agent.id, 'general'));
        },
    });

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Agents</SidebarGroupLabel>
            <SidebarGroupAction
                aria-label="Create agent"
                className="right-4"
                disabled={createAgent.isPending}
                onClick={() => {
                    void withSavingToast(() =>
                        createAgent.mutateAsync({ name: createNewAgentName(agents) })
                    ).catch(() => undefined);
                }}
                title="Create agent"
            >
                <Icon aria-hidden="true" icon={Plus} />
            </SidebarGroupAction>
            <SidebarGroupContent>
                <SidebarMenu>
                    {agentsQuery.isPending ? (
                        <SidebarMenuItem>
                            <div className="px-2 py-2 text-sidebar-muted text-sm">
                                Loading agents...
                            </div>
                        </SidebarMenuItem>
                    ) : null}

                    {agents.map((agent) => (
                        <AgentSettingsNavGroup
                            agent={agent}
                            capability={capability}
                            key={agent.id}
                        />
                    ))}

                    {agentsQuery.isPending || agents.length > 0 ? null : (
                        <SidebarMenuItem>
                            <div className="px-2 py-2 text-sidebar-muted text-sm">
                                No agents synced
                            </div>
                        </SidebarMenuItem>
                    )}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function AgentSettingsNavGroup({
    agent,
    capability,
}: {
    agent: AgentListOutput['agents'][number];
    capability: ResolveCapability;
}) {
    const location = useLocation();
    const activeAgentPage = getActiveAgentPage(location.pathname);
    const isAgentActive = activeAgentPage?.agentId === agent.id;
    const [manuallyOpen, setManuallyOpen] = React.useState<boolean | null>(null);
    const isOpen = resolveAgentSettingsNavOpen({ isAgentActive, manualOpen: manuallyOpen });

    return (
        <SidebarMenuItem>
            <Collapsible onOpenChange={setManuallyOpen} open={isOpen}>
                <SidebarMenuButton render={<CollapsibleTrigger />} tooltip={agent.name}>
                    <AgentAvatar agent={agent} />
                    <span className="min-w-0 truncate">{agent.name}</span>
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            'ml-auto size-3.5 transition-transform',
                            isOpen && 'rotate-90'
                        )}
                        icon={ArrowRight01Icon}
                    />
                </SidebarMenuButton>
                <CollapsiblePanel>
                    <SidebarMenuSub>
                        {agentSettingsNavItems.map((item) => {
                            const gate = capability(settingsCapabilityRequirements[item.id]);
                            const to = buildAgentSettingsPath(agent.id, item.tab);
                            const isActive =
                                isAgentActive && activeAgentPage?.tab === item.tab && gate.healthy;

                            return (
                                <SidebarMenuSubItem key={item.id}>
                                    {gate.healthy ? (
                                        <NavLink className="contents" to={to}>
                                            {({ isActive: isLinkActive }) => (
                                                <SidebarMenuSubButton
                                                    isActive={isActive || isLinkActive}
                                                    render={<div />}
                                                >
                                                    <Icon
                                                        aria-hidden="true"
                                                        className="shrink-0"
                                                        icon={item.icon}
                                                        size={16}
                                                    />
                                                    <span className="min-w-0 truncate">
                                                        {item.label}
                                                    </span>
                                                </SidebarMenuSubButton>
                                            )}
                                        </NavLink>
                                    ) : (
                                        <SidebarMenuSubButton
                                            aria-disabled="true"
                                            className="opacity-50"
                                            render={<span />}
                                            title={formatCapabilityDisabledReason(gate)}
                                        >
                                            <Icon
                                                aria-hidden="true"
                                                className="shrink-0"
                                                icon={item.icon}
                                                size={16}
                                            />
                                            <span className="min-w-0 truncate">{item.label}</span>
                                        </SidebarMenuSubButton>
                                    )}
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsiblePanel>
            </Collapsible>
        </SidebarMenuItem>
    );
}

function AgentAvatar({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
            <AgentFace
                animate={false}
                dark={dark}
                head={agent.effectiveCharacter}
                ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                size={24}
                style={faceStyle}
            />
        </span>
    );
}
