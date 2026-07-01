import {
    type AgentCharacter,
    agentCharacterLabels,
    agentCharacters,
} from '@tavern/api/agent-appearance';
import { useEffect, useState } from 'react';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import {
    Popover,
    PopoverClose,
    PopoverContent,
    PopoverTrigger,
} from '../../../components/ui/popover.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectTriggerIcon,
    SelectValue,
    selectTriggerVariants,
} from '../../../components/ui/select.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { type AgentListOutput, trpc } from '../../../lib/trpc.tsx';
import { cn } from '../../../lib/utils.ts';
import { agentColorPresets } from '../../agents/agent-color-presets.ts';
import { useAgentProfileUpdate } from '../../agents/use-agent-profile-update.ts';
import { AgentFace } from '../../chats/agent-face.tsx';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

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
    const [displayName, setDisplayName] = useState(agent.name);
    const isSaving = disabled || updateName.isPending;

    useEffect(() => {
        setDisplayName(agent.name);
    }, [agent.name]);

    const selectedColor = agent.effectivePrimaryColor;
    const selectedColorPreset =
        agentColorPresets.find(
            (preset) => preset.color.toLowerCase() === selectedColor.toLowerCase()
        ) ?? null;

    return (
        <SettingsSection title="Appearance">
            <SettingsGroup>
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
                                    color.toLowerCase() === agent.defaultPrimaryColor.toLowerCase()
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
                                    <AgentColorOption color={preset.color} label={preset.label} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsRow>

                <Separator />

                <SettingsRow title="Character">
                    <AgentCharacterPicker
                        disabled={saveAgentProfile.isPending}
                        onSelect={(character) =>
                            saveAgentProfile.mutate({
                                agentId: agent.id,
                                character: character === agent.defaultCharacter ? null : character,
                            })
                        }
                        selected={agent.effectiveCharacter}
                    />
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}

function AgentCharacterPicker({
    disabled,
    onSelect,
    selected,
}: {
    disabled: boolean;
    onSelect: (character: AgentCharacter) => void;
    selected: AgentCharacter;
}) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <Popover>
            <PopoverTrigger className={selectTriggerVariants()} disabled={disabled}>
                <span className="flex min-w-0 flex-1 items-center truncate">
                    <AgentCharacterOption character={selected} dark={dark} />
                </span>
                <SelectTriggerIcon />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72">
                <div className="grid grid-cols-4 gap-2">
                    {agentCharacters.map((character) => {
                        const isSelected = character === selected;

                        return (
                            <PopoverClose
                                aria-label={agentCharacterLabels[character]}
                                aria-pressed={isSelected}
                                className={cn(
                                    'flex aspect-square items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                                    isSelected
                                        ? 'border-brand bg-input/40'
                                        : 'border-transparent bg-input/24 hover:bg-input/48'
                                )}
                                key={character}
                                onClick={() => onSelect(character)}
                                title={agentCharacterLabels[character]}
                            >
                                <AgentFace
                                    animate={false}
                                    dark={dark}
                                    head={character}
                                    size={44}
                                    style={faceStyle}
                                />
                            </PopoverClose>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function AgentCharacterOption({ character, dark }: { character: AgentCharacter; dark: boolean }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <AgentFace animate={false} dark={dark} head={character} size={18} style={faceStyle} />
            <span className="truncate">{agentCharacterLabels[character]}</span>
        </span>
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
