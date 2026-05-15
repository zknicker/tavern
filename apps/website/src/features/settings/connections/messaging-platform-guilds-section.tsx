import { Plus, ServerStack03Icon, Trash2 } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Frame, FrameHeader, FramePanel } from '../../../components/ui/frame.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsActionRow,
    SettingsItem,
    SettingsRow,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { MessagingPlatformChannelList } from './messaging-platform-channel-list.tsx';
import type { DiscordGuildDraft } from './messaging-platform-shared.ts';

export function MessagingPlatformGuildsSection({
    disabled,
    guilds,
    onGuildsChange,
}: {
    disabled: boolean;
    guilds: DiscordGuildDraft[];
    onGuildsChange: (guilds: DiscordGuildDraft[]) => void;
}) {
    function addGuild() {
        onGuildsChange([
            ...guilds,
            {
                channelIds: [],
                draftKey: createGuildDraftKey(),
                id: '',
                ignoreOtherMentions: true,
                requireMention: true,
            },
        ]);
    }

    function updateGuild(index: number, updater: (guild: DiscordGuildDraft) => DiscordGuildDraft) {
        onGuildsChange(
            guilds.map((guild, currentIndex) => (currentIndex === index ? updater(guild) : guild))
        );
    }

    function removeGuild(index: number) {
        onGuildsChange(guilds.filter((_, currentIndex) => currentIndex !== index));
    }

    return (
        <section>
            <div className="flex items-start justify-between gap-3 pb-1.5">
                <div className="min-w-0">
                    <h3 className="font-medium text-foreground text-sm">Servers</h3>
                </div>
                <Button
                    disabled={disabled || guilds.some((guild) => guild.id.trim().length === 0)}
                    onClick={addGuild}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" className="opacity-100" icon={Plus} />
                    Add
                </Button>
            </div>

            <div className="grid gap-1.5">
                {guilds.length > 0 ? (
                    guilds.map((guild, index) => (
                        <GuildEditor
                            disabled={disabled}
                            guild={guild}
                            key={guild.draftKey ?? guild.id}
                            onChange={(updater) => updateGuild(index, updater)}
                            onRemove={() => removeGuild(index)}
                        />
                    ))
                ) : (
                    <CardFrame>
                        <Card className="overflow-hidden p-0">
                            <div className="px-5 py-5 text-center text-muted-foreground text-sm">
                                No servers configured
                            </div>
                        </Card>
                    </CardFrame>
                )}
            </div>
        </section>
    );
}

function GuildEditor({
    disabled,
    guild,
    onChange,
    onRemove,
}: {
    disabled: boolean;
    guild: DiscordGuildDraft;
    onChange: (updater: (guild: DiscordGuildDraft) => DiscordGuildDraft) => void;
    onRemove: () => void;
}) {
    const guildId = guild.id.trim();
    const [isEditingGuildId] = React.useState(() => guildId.length === 0);
    const [isAddingChannel, setIsAddingChannel] = React.useState(false);
    const [channelDraft, setChannelDraft] = React.useState('');

    function resetChannelDraft() {
        setChannelDraft('');
        setIsAddingChannel(false);
    }

    function addChannelDraft() {
        const value = channelDraft.trim();

        if (!(value && !guild.channelIds.includes(value))) {
            return;
        }

        onChange((current) => ({
            ...current,
            channelIds: [...current.channelIds, value],
        }));
        resetChannelDraft();
    }

    return (
        <Frame className="-mx-1.5 w-[calc(100%+0.75rem)]">
            <FrameHeader className="flex-row items-center justify-between px-0.5 pt-0.5 pb-1">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-secondary text-foreground/72">
                        <Icon aria-hidden="true" className="size-4" icon={ServerStack03Icon} />
                    </span>
                    <div className="flex min-w-0 items-baseline gap-1.5">
                        {guildId ? (
                            <>
                                <span className="shrink-0 font-medium text-foreground text-sm">
                                    Server
                                </span>
                                <span className="min-w-0 truncate font-mono text-meta text-muted-foreground">
                                    {guildId}
                                </span>
                            </>
                        ) : (
                            <span className="font-medium text-foreground text-sm">New server</span>
                        )}
                    </div>
                </div>
            </FrameHeader>

            <div className="grid gap-1.5">
                <FramePanel className="p-0">
                    <Card className="overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none dark:before:hidden">
                        {isEditingGuildId ? (
                            <>
                                <SettingsRow title="Server ID">
                                    <Input
                                        autoFocus
                                        disabled={disabled}
                                        onChange={(event) =>
                                            onChange((current) => ({
                                                ...current,
                                                id: event.target.value,
                                            }))
                                        }
                                        placeholder="1090835947375054888"
                                        value={guild.id}
                                    />
                                </SettingsRow>
                                <Separator />
                            </>
                        ) : null}
                        <SettingsRow title="Require mention">
                            <div className="flex justify-start md:justify-end">
                                <Switch
                                    checked={guild.requireMention}
                                    disabled={disabled}
                                    onCheckedChange={(requireMention) =>
                                        onChange((current) => ({
                                            ...current,
                                            requireMention,
                                        }))
                                    }
                                />
                            </div>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow title="Ignore other mentions">
                            <div className="flex justify-start md:justify-end">
                                <Switch
                                    checked={guild.ignoreOtherMentions}
                                    disabled={disabled}
                                    onCheckedChange={(ignoreOtherMentions) =>
                                        onChange((current) => ({
                                            ...current,
                                            ignoreOtherMentions,
                                        }))
                                    }
                                />
                            </div>
                        </SettingsRow>
                        <Separator />
                        <SettingsRow className="py-2" title="Delete Server">
                            <div className="-mr-3 flex justify-start md:justify-end">
                                <Button
                                    aria-label="Delete Server"
                                    disabled={disabled}
                                    onClick={onRemove}
                                    size="icon"
                                    type="button"
                                    variant="destructive-ghost"
                                >
                                    <Icon icon={Trash2} />
                                </Button>
                            </div>
                        </SettingsRow>
                    </Card>
                </FramePanel>

                <FramePanel className="p-0">
                    <Card className="overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none dark:before:hidden">
                        {isAddingChannel ? (
                            <SettingsItem className="py-2">
                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                                    <Input
                                        autoFocus
                                        disabled={disabled}
                                        onChange={(event) => setChannelDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                addChannelDraft();
                                            }
                                        }}
                                        placeholder="930000000000000000"
                                        value={channelDraft}
                                    />
                                    <div className="flex shrink-0 gap-2">
                                        <Button
                                            disabled={disabled || channelDraft.trim().length === 0}
                                            onClick={addChannelDraft}
                                            size="sm"
                                            type="button"
                                        >
                                            Add
                                        </Button>
                                        <Button
                                            onClick={resetChannelDraft}
                                            size="sm"
                                            type="button"
                                            variant="secondary"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </SettingsItem>
                        ) : null}
                        {isAddingChannel && guild.channelIds.length > 0 ? <Separator /> : null}
                        <MessagingPlatformChannelList
                            channelIds={guild.channelIds}
                            disabled={disabled}
                            onChange={(channelIds) =>
                                onChange((current) => ({
                                    ...current,
                                    channelIds,
                                }))
                            }
                            showEmpty={!isAddingChannel}
                        />
                        {isAddingChannel || guild.channelIds.length > 0 ? <Separator /> : null}
                        <SettingsActionRow
                            disabled={disabled || isAddingChannel}
                            onClick={() => setIsAddingChannel(true)}
                        >
                            <Icon aria-hidden="true" className="opacity-100" icon={Plus} />
                            {guild.channelIds.length > 0 ? 'Add channel' : 'Restrict to channel'}
                        </SettingsActionRow>
                    </Card>
                </FramePanel>
            </div>
        </Frame>
    );
}

function createGuildDraftKey() {
    return typeof crypto === 'undefined' || !crypto.randomUUID
        ? `guild-${Date.now()}`
        : crypto.randomUUID();
}
