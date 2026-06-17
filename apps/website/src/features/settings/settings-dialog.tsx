import type { IconSvgElement } from '@hugeicons/react';
import {
    Cancel01Icon,
    Clock04Icon,
    ConnectIcon,
    PaintBrush01Icon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-duotone-rounded';
import { AiBrain01Icon, ChatIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Dialog,
    DialogBackdrop,
    DialogPortal,
    DialogPrimitive,
    DialogViewport,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Nav, NavItem } from '../../components/ui/nav.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { AgentRuntimeSettings } from './agent-runtime/page.tsx';
import { AppearanceSettings } from './appearance/page.tsx';
import { JobsSettings } from './jobs/page.tsx';
import { MemoriesSettings } from './memories/page.tsx';
import { ModelsSettings } from './models/page.tsx';
import { ParticipantsSettings } from './participants/page.tsx';
import { SessionsSettings } from './sessions/page.tsx';

export type SettingsTab =
    | 'appearance'
    | 'jobs'
    | 'memories'
    | 'models'
    | 'participants'
    | 'sessions'
    | 'agent-runtime';

const settingsTabs: Array<{
    icon: IconSvgElement;
    id: SettingsTab;
    label: string;
}> = [
    { id: 'agent-runtime', label: 'Tavern Runtime', icon: ConnectIcon },
    { id: 'participants', label: 'Profile', icon: UserMultiple02Icon },
    { id: 'appearance', label: 'Appearance', icon: PaintBrush01Icon },
    { id: 'sessions', label: 'Sessions', icon: ChatIcon },
    { id: 'models', label: 'Models', icon: AiBrain01Icon },
    { id: 'memories', label: 'Vault', icon: Clock04Icon },
    { id: 'jobs', label: 'Jobs', icon: Clock04Icon },
];

const tabContent: Record<
    SettingsTab,
    { component: React.ComponentType; scrollBehavior: 'content' | 'dialog' }
> = {
    appearance: {
        component: AppearanceSettings,
        scrollBehavior: 'dialog',
    },
    'agent-runtime': {
        component: AgentRuntimeSettings,
        scrollBehavior: 'dialog',
    },
    models: {
        component: ModelsSettings,
        scrollBehavior: 'dialog',
    },
    memories: {
        component: MemoriesSettings,
        scrollBehavior: 'dialog',
    },
    participants: {
        component: ParticipantsSettings,
        scrollBehavior: 'dialog',
    },
    sessions: {
        component: SessionsSettings,
        scrollBehavior: 'dialog',
    },
    jobs: {
        component: JobsSettings,
        scrollBehavior: 'content',
    },
};

interface SettingsDialogProps {
    defaultTab?: SettingsTab;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}

export function SettingsDialog({
    defaultTab = 'agent-runtime',
    onOpenChange,
    open,
}: SettingsDialogProps) {
    const [activeTab, setActiveTab] = React.useState<SettingsTab>(defaultTab);

    React.useEffect(() => {
        if (open) {
            setActiveTab(defaultTab);
        }
    }, [open, defaultTab]);

    const activeContent = tabContent[activeTab];
    const ActiveContent = activeContent.component;

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogPortal>
                <DialogBackdrop />
                <DialogViewport className="grid-rows-[1fr_auto_1fr] p-6 sm:p-10">
                    <DialogPrimitive.Popup
                        className="relative row-start-2 flex h-[min(640px,80vh)] w-full max-w-4xl origin-center flex-row overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform data-ending-style:opacity-0 data-starting-style:opacity-0 sm:data-ending-style:scale-98 sm:data-starting-style:scale-98"
                        data-slot="dialog-popup"
                    >
                        <div className="flex w-[180px] shrink-0 flex-col border-border border-r bg-[var(--color-chrome)]">
                            <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                                <DialogPrimitive.Close className="flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-1 text-foreground text-sm transition-colors hover:bg-black/[0.10] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]">
                                    <Icon icon={Cancel01Icon} size={16} />
                                    <span>Close</span>
                                </DialogPrimitive.Close>
                            </div>
                            <nav className="flex-1 px-2 pb-2">
                                <Nav>
                                    {settingsTabs.map((tab) => (
                                        <NavItem
                                            active={activeTab === tab.id}
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            <Icon
                                                aria-hidden="true"
                                                className="shrink-0"
                                                icon={tab.icon}
                                                size={22}
                                            />
                                            {tab.label}
                                        </NavItem>
                                    ))}
                                </Nav>
                            </nav>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                            {activeContent.scrollBehavior === 'dialog' ? (
                                <ScrollArea>
                                    <div className="px-6 pt-5 pb-6">
                                        <ActiveContent />
                                    </div>
                                </ScrollArea>
                            ) : (
                                <ActiveContent />
                            )}
                        </div>
                    </DialogPrimitive.Popup>
                </DialogViewport>
            </DialogPortal>
        </Dialog>
    );
}
