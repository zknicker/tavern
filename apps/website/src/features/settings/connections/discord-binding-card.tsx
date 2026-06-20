import { Trash2 } from '@hugeicons/core-free-icons';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsItem } from '../../../components/ui/settings-row.tsx';
import { cn } from '../../../lib/utils.ts';
import { DiscordIcon } from './messaging-platform-discord-icon.tsx';
import type { MessagingBinding, PlatformAgentOption } from './messaging-platform-shared.ts';

export function DiscordBindingCard({
    agentOptions,
    binding,
    deleteBinding,
    deletePending,
    isAgentRuntimeAvailable,
    onEditBinding,
    showAgent = true,
}: {
    agentOptions: PlatformAgentOption[];
    binding: MessagingBinding;
    deleteBinding: (id: string) => Promise<void>;
    deletePending: boolean;
    isAgentRuntimeAvailable: boolean;
    onEditBinding: (binding: MessagingBinding) => void;
    showAgent?: boolean;
}) {
    const agent = agentOptions.find((option) => option.value === binding.agentId) ?? {
        idLabel: binding.agentId,
        summary: `Workspace ${binding.agentId}`,
        title: binding.agentId,
        value: binding.agentId,
    };
    const routingSummary = formatRoutingSummary(binding);

    return (
        <SettingsItem
            className={cn(
                'grid gap-4 py-4 md:items-center',
                showAgent
                    ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'
                    : 'md:grid-cols-[minmax(0,1fr)_auto]'
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-[#5865F2]">
                    <DiscordIcon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="truncate font-medium text-foreground text-sm">Discord</p>
                    <p className="truncate text-muted-foreground text-sm">
                        {showAgent
                            ? routingSummary
                            : `${binding.enabled ? 'Enabled' : 'Disabled'} · ${routingSummary}`}
                    </p>
                </div>
            </div>
            {showAgent ? (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-sm">
                            {agent.title}
                        </p>
                        <p className="truncate text-muted-foreground text-sm">
                            {binding.enabled ? 'Enabled' : 'Disabled'} · {binding.agentId}
                        </p>
                    </div>
                </div>
            ) : null}
            <div className="flex shrink-0 items-center gap-2">
                <Button onClick={() => onEditBinding(binding)} size="sm" variant="secondary">
                    Edit
                </Button>
                <Button
                    aria-label="Delete Discord connection"
                    disabled={!isAgentRuntimeAvailable}
                    loading={deletePending}
                    onClick={() => deleteBinding(binding.id)}
                    size="icon"
                    variant="destructive-ghost"
                >
                    <Icon icon={Trash2} />
                </Button>
            </div>
        </SettingsItem>
    );
}

function formatRoutingSummary(binding: MessagingBinding) {
    if (binding.groupPolicy === 'open') {
        return 'All Discord servers';
    }

    if (binding.groupPolicy === 'disabled') {
        return 'Group chats disabled';
    }

    const serverCount = binding.match.guildIds.length;
    const channelCount = binding.match.channelIds.length;

    if (serverCount === 0 && channelCount === 0) {
        return 'No servers or channels';
    }

    if (serverCount > 0 && channelCount > 0) {
        return `${serverCount} server${serverCount === 1 ? '' : 's'}, ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
    }

    if (serverCount > 0) {
        return `${serverCount} server${serverCount === 1 ? '' : 's'}`;
    }

    return `${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
