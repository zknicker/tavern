import { AgentAvatar } from '../../../components/ui/agent-avatar.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import type { ParticipantListOutput } from '../../../lib/trpc.tsx';
import { agentColorPresets } from '../../agents/agent-color-presets.ts';
import { ColorPresetBadge } from '../../agents/color-preset-badge.tsx';
import { useParticipantCard } from './use-participant-card.ts';

interface ParticipantCardProps {
    isPending: boolean;
    linkedParticipants: ParticipantListOutput['participants'];
    onSave: (input: {
        avatar: string | null;
        displayName: string | null;
        primaryColor: string | null;
    }) => void;
    profile: ParticipantListOutput['profile'];
}

export function ParticipantCard({
    isPending,
    linkedParticipants,
    onSave,
    profile,
}: ParticipantCardProps) {
    const {
        avatar,
        displayName,
        handleAvatarChange,
        handleColorChange,
        handleNameChange,
        primaryColor,
    } = useParticipantCard({
        onSave,
        profile,
    });
    const previewName = displayName.trim() || 'Tavern';

    return (
        <CardFrame>
            <Card className="overflow-hidden p-0">
                <SettingsRow description="How you appear in Tavern." title="Preview">
                    <div className="flex items-center gap-3 md:justify-end">
                        <AgentAvatar
                            avatar={avatar}
                            backgroundColor={primaryColor}
                            className="size-9 shrink-0"
                            name={previewName}
                        />
                        <div className="min-w-0 md:text-right">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-foreground text-sm">
                                    {previewName}
                                </p>
                                <Badge size="sm" variant="success">
                                    You
                                </Badge>
                                {isPending ? (
                                    <Badge size="sm" variant="secondary">
                                        Updating
                                    </Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </SettingsRow>
                <Separator />
                <SettingsRow
                    description="Used when a linked identity appears."
                    title="Display name"
                >
                    <Input
                        onChange={(event) => handleNameChange(event.target.value)}
                        placeholder="Tavern"
                        value={displayName}
                    />
                </SettingsRow>

                <Separator />

                <SettingsRow description="Accounts already linked to this profile." title="Linked">
                    <div className="flex flex-wrap gap-2 md:justify-end">
                        {linkedParticipants.map((participant) => (
                            <Badge key={participant.id} size="sm" variant="secondary">
                                {participant.provider}: {participant.observedName}
                            </Badge>
                        ))}
                        {linkedParticipants.length === 0 ? (
                            <span className="text-meta text-muted-foreground">None</span>
                        ) : null}
                    </div>
                </SettingsRow>

                <Separator />

                <SettingsRow description="Use initials, an emoji, or a short label." title="Avatar">
                    <Input
                        maxLength={160}
                        onChange={(event) => handleAvatarChange(event.target.value)}
                        placeholder={avatar || previewName}
                        value={avatar}
                    />
                </SettingsRow>

                <Separator />

                <SettingsRow description="Used for your profile avatar." title="Color">
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {agentColorPresets.map((preset) => {
                            const isSelected =
                                primaryColor.toLowerCase() === preset.color.toLowerCase();

                            return (
                                <ColorPresetBadge
                                    color={preset.color}
                                    isSelected={isSelected}
                                    key={`${profile.id}:${preset.color}`}
                                    label={preset.label}
                                    onClick={() => handleColorChange(preset.color)}
                                />
                            );
                        })}
                    </div>
                </SettingsRow>
            </Card>
        </CardFrame>
    );
}
