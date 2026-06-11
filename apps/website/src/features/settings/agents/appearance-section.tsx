import { useEffect, useState } from 'react';
import { BadgeDivider } from '../../../components/ui/badge-divider.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import { resolveAgentGlyph } from '../../../hooks/agents/use-agent-avatar-directory.ts';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, trpc } from '../../../lib/trpc.tsx';
import { agentColorPresets } from '../../agents/agent-color-presets.ts';
import { useAgentProfileUpdate } from '../../agents/use-agent-profile-update.ts';

export function AgentAppearanceSection({
    agent,
    disabled,
}: {
    agent: AgentListOutput['agents'][number];
    disabled: boolean;
}) {
    const utils = trpc.useUtils();
    const saveAgentProfile = useAgentProfileUpdate();
    const invalidateAgents = async () => {
        await Promise.all([utils.agent.list.invalidate(), utils.agent.primary.invalidate()]);
    };
    const updateName = trpc.agent.updateName.useMutation({ onSuccess: invalidateAgents });
    const updateAppearance = trpc.agent.updateAppearance.useMutation({
        onSuccess: invalidateAgents,
    });
    const [displayName, setDisplayName] = useState(agent.name);
    const [avatar, setAvatar] = useState(agent.avatar ?? '');
    const isSaving = disabled || updateName.isPending || updateAppearance.isPending;

    useEffect(() => {
        setDisplayName(agent.name);
    }, [agent.name]);

    useEffect(() => {
        setAvatar(agent.avatar ?? '');
    }, [agent.avatar]);

    const selectedColor = agent.effectivePrimaryColor;
    const selectedColorPreset =
        agentColorPresets.find(
            (preset) => preset.color.toLowerCase() === selectedColor.toLowerCase()
        ) ?? null;

    return (
        <section>
            <BadgeDivider className="pb-4">Appearance</BadgeDivider>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow title="Display name">
                        <Input
                            disabled={isSaving}
                            id="agent-display-name"
                            name="agent-display-name"
                            onBlur={() => {
                                const nextName = displayName.trim() || agent.id;

                                if (nextName === agent.name) {
                                    return;
                                }

                                void withSavingToast(() =>
                                    updateName.mutateAsync({
                                        agentId: agent.id,
                                        name: nextName,
                                    })
                                ).catch(() => undefined);
                            }}
                            onChange={(event) => {
                                setDisplayName(event.target.value);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                }
                            }}
                            placeholder={agent.id}
                            value={displayName}
                        />
                    </SettingsRow>

                    <Separator />

                    <SettingsRow description="A character or two, or an emoji." title="Avatar">
                        <Input
                            disabled={isSaving}
                            id="agent-avatar"
                            maxLength={8}
                            name="agent-avatar"
                            onBlur={() => {
                                const nextAvatar = avatar.trim() || null;

                                if (nextAvatar === (agent.avatar ?? null)) {
                                    return;
                                }

                                void withSavingToast(() =>
                                    updateAppearance.mutateAsync({
                                        agentId: agent.id,
                                        avatar: nextAvatar,
                                    })
                                ).catch(() => undefined);
                            }}
                            onChange={(event) => {
                                setAvatar(event.target.value);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                }
                            }}
                            placeholder={resolveAgentGlyph({ avatar: null, name: agent.name })}
                            value={avatar}
                        />
                    </SettingsRow>

                    <Separator />

                    <SettingsRow title="Color">
                        <Select
                            disabled={saveAgentProfile.isPending}
                            onValueChange={(color) => {
                                if (!color) {
                                    return;
                                }

                                saveAgentProfile.mutate({
                                    agentId: agent.id,
                                    primaryColor:
                                        color.toLowerCase() ===
                                        agent.defaultPrimaryColor.toLowerCase()
                                            ? null
                                            : color,
                                });
                            }}
                            value={selectedColor.toLowerCase()}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose color">
                                    <AgentColorOption
                                        color={selectedColor}
                                        label={selectedColorPreset?.label ?? selectedColor}
                                    />
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {agentColorPresets.map((preset) => (
                                    <SelectItem key={preset.color} value={preset.color}>
                                        <AgentColorOption
                                            color={preset.color}
                                            label={preset.label}
                                        />
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                </Card>
            </CardFrame>
        </section>
    );
}

function AgentColorOption({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate">{label}</span>
        </span>
    );
}
