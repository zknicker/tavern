import { ArrowLeft02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../../components/ui/sidebar.tsx';
import {
    formatCapabilityDisabledReason,
    settingsCapabilityRequirements,
    useCapability,
} from '../../../hooks/connections/use-capability.ts';
import { queryPolicy } from '../../../lib/query-policy.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { settingsNavItems, settingsNavSections } from './navigation.ts';

const settingsNavItemsById = new Map(settingsNavItems.map((item) => [item.id, item]));

export function SettingsSidebarNav({ onBackToApp }: { onBackToApp?: () => void }) {
    const capability = useCapability();
    const utils = trpc.useUtils();
    const prefetchModelsSettings = React.useCallback(() => {
        void import('../../../routes/dashboard/settings-models-page.tsx');
        void utils.model.inventory.prefetch(undefined, queryPolicy.runtimeModelSnapshot);
    }, [utils]);

    return (
        <>
            {onBackToApp ? (
                <SidebarGroup className="pt-2">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    className="text-sidebar-muted"
                                    onClick={onBackToApp}
                                >
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
            ) : null}
            {settingsNavSections.map((section) => (
                <SidebarGroup key={section.id}>
                    <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {section.itemIds.map((itemId) => {
                                const item = settingsNavItemsById.get(itemId);

                                if (!item) {
                                    return null;
                                }

                                const gate = capability(settingsCapabilityRequirements[item.id]);
                                const disabledReason = gate.healthy
                                    ? null
                                    : formatCapabilityDisabledReason(gate);

                                return (
                                    <SidebarMenuItem key={item.id}>
                                        {gate.healthy ? (
                                            <NavLink className="contents" to={item.to}>
                                                {({ isActive }) => (
                                                    <SidebarMenuButton
                                                        isActive={isActive}
                                                        onFocus={
                                                            item.id === 'models'
                                                                ? prefetchModelsSettings
                                                                : undefined
                                                        }
                                                        onPointerEnter={
                                                            item.id === 'models'
                                                                ? prefetchModelsSettings
                                                                : undefined
                                                        }
                                                        render={<div />}
                                                    >
                                                        <Icon
                                                            aria-hidden="true"
                                                            className="shrink-0"
                                                            icon={item.icon}
                                                            size={18}
                                                        />
                                                        <span className="min-w-0 truncate">
                                                            {item.label}
                                                        </span>
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
                                                <Icon
                                                    aria-hidden="true"
                                                    className="shrink-0"
                                                    icon={item.icon}
                                                    size={18}
                                                />
                                                <span className="min-w-0 truncate">
                                                    {item.label}
                                                </span>
                                            </SidebarMenuButton>
                                        )}
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
        </>
    );
}
