import type { IconSvgElement } from '@hugeicons/react';
import { ComputerIcon, Moon02Icon, Sun01Icon } from '@hugeicons-pro/core-duotone-rounded';
import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { type ThemePreference, useTheme } from '../../../components/theme-provider.tsx';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useChatThinkingDisplayPreference } from '../../../hooks/chats/use-chat-thinking-display-preference.ts';
import { useChatVirtualizationPreference } from '../../../hooks/chats/use-chat-virtualization-preference.ts';
import { useAppLayoutPreference } from '../../../hooks/dashboard/use-app-layout-preference.ts';
import { cn } from '../../../lib/utils.ts';

const themeOptions: Array<{
    description: string;
    icon: IconSvgElement;
    id: ThemePreference;
    label: string;
}> = [
    { id: 'light', label: 'Light', description: 'Always use light mode', icon: Sun01Icon },
    { id: 'dark', label: 'Dark', description: 'Always use dark mode', icon: Moon02Icon },
    { id: 'system', label: 'System', description: 'Match your OS preference', icon: ComputerIcon },
];

export function AppearanceSettings() {
    const { setTheme, theme } = useTheme();
    const appLayout = useAppLayoutPreference();
    const chatThinkingDisplay = useChatThinkingDisplayPreference();
    const chatVirtualization = useChatVirtualizationPreference();

    return (
        <div className="space-y-8">
            <div>
                <BadgeDivider className="pb-5">Theme Mode</BadgeDivider>
                <div className="grid gap-4 sm:grid-cols-3">
                    {themeOptions.map((option) => {
                        const isActive = option.id === theme;

                        return (
                            <button
                                aria-pressed={isActive}
                                className={cn(
                                    'no-drag group relative flex flex-col overflow-hidden rounded-2xl border bg-popover not-dark:bg-clip-padding text-left shadow-xs/5 outline-none transition-shadow dark:bg-input/32',
                                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                                    isActive
                                        ? 'border-brand'
                                        : 'border-input hover:bg-accent/50 dark:hover:bg-input/64'
                                )}
                                key={option.id}
                                onClick={() => setTheme(option.id)}
                                type="button"
                            >
                                <ThemePreview isActive={isActive} variant={option.id} />
                                <div className="flex items-center justify-between gap-2 px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Icon
                                            aria-hidden="true"
                                            className={cn(
                                                isActive
                                                    ? 'text-brand'
                                                    : 'text-muted-foreground group-hover:text-foreground'
                                            )}
                                            icon={option.icon}
                                            size={24}
                                        />
                                        <div className="min-w-0">
                                            <div
                                                className={cn(
                                                    'truncate font-semibold text-sm leading-none',
                                                    isActive
                                                        ? 'text-foreground'
                                                        : 'text-foreground/85'
                                                )}
                                            >
                                                {option.label}
                                            </div>
                                            <div className="mt-1 truncate text-muted-foreground text-xs leading-none">
                                                {option.description}
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
                                            isActive
                                                ? 'bg-brand text-brand-foreground'
                                                : 'border border-border bg-transparent'
                                        )}
                                    >
                                        {isActive ? (
                                            <Icon
                                                className="size-3"
                                                icon={Tick02Icon}
                                                strokeWidth={3}
                                            />
                                        ) : null}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                <BadgeDivider className="pb-3">App Layout</BadgeDivider>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <SettingsRow
                        description="Use a sidebar for app navigation."
                        title="Side navigation"
                    >
                        <div className="flex justify-start md:justify-end">
                            <Switch
                                aria-label="Side navigation"
                                checked={appLayout.mode === 'sidebar'}
                                onCheckedChange={(enabled) =>
                                    appLayout.setMode(enabled ? 'sidebar' : 'tabs')
                                }
                            />
                        </div>
                    </SettingsRow>
                </div>
            </div>

            <div>
                <BadgeDivider className="pb-3">Chat Display</BadgeDivider>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <SettingsRow
                        description="Show the model's reasoning in chats."
                        title="Show thinking text"
                    >
                        <div className="flex justify-start md:justify-end">
                            <Switch
                                aria-label="Show thinking text"
                                checked={chatThinkingDisplay.enabled}
                                onCheckedChange={chatThinkingDisplay.setEnabled}
                            />
                        </div>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow
                        description="Keep long chats smooth while scrolling."
                        title="Virtualize chat history"
                    >
                        <div className="flex justify-start md:justify-end">
                            <Switch
                                aria-label="Virtualize chat history"
                                checked={chatVirtualization.enabled}
                                onCheckedChange={chatVirtualization.setEnabled}
                            />
                        </div>
                    </SettingsRow>
                </div>
            </div>
        </div>
    );
}

function ThemePreview({ isActive, variant }: { isActive: boolean; variant: ThemePreference }) {
    return (
        <div
            className={cn(
                'relative aspect-[16/7] w-full overflow-hidden border-b',
                isActive ? 'border-brand-ring' : 'border-border'
            )}
        >
            {variant === 'system' ? <SystemSurface /> : <ToneSurface tone={variant} />}
        </div>
    );
}

function ToneSurface({ tone }: { tone: 'dark' | 'light' }) {
    return (
        <div className={cn('relative h-full w-full', frameClass(tone))}>
            <ToneWindow tone={tone} />
        </div>
    );
}

function SystemSurface() {
    return (
        <div className="relative flex h-full w-full">
            <div className={cn('relative flex-1', frameClass('dark'))}>
                <ToneWindow insetLeft="30%" tone="dark" />
            </div>
            <div className={cn('relative flex-1', frameClass('light'))}>
                <ToneWindow insetLeft="30%" tone="light" />
            </div>
        </div>
    );
}

function ToneWindow({ insetLeft = '22%', tone }: { insetLeft?: string; tone: 'dark' | 'light' }) {
    const isDark = tone === 'dark';
    const windowSurface = isDark
        ? 'bg-zinc-950 text-white shadow-[0_10px_22px_-6px_rgba(0,0,0,0.55)]'
        : 'bg-white text-zinc-900 shadow-[0_10px_22px_-6px_rgba(0,0,0,0.2)]';
    const titlebar = isDark
        ? 'bg-zinc-800 border-b border-zinc-700/60'
        : 'bg-zinc-100 border-b border-zinc-200';

    return (
        <div
            className={cn(
                'absolute top-[18%] right-0 bottom-0 flex flex-col overflow-hidden rounded-tl-2xl',
                windowSurface
            )}
            style={{ left: insetLeft }}
        >
            <div className={cn('flex h-10 shrink-0 items-center gap-1.5 pr-3 pl-4', titlebar)}>
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex flex-1 items-center justify-end pr-5">
                <span className="font-bold text-3xl tracking-tight">Aa</span>
            </div>
        </div>
    );
}

function frameClass(tone: 'dark' | 'light') {
    return tone === 'dark' ? 'bg-zinc-600' : 'bg-zinc-200';
}
