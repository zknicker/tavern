import type * as React from 'react';
import { AgentPicker } from '../../../components/ui/agent-picker.tsx';
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
import { Switch } from '../../../components/ui/switch.tsx';
import type {
    BindingDraft,
    DiscordAllowBots,
    DiscordGroupPolicy,
    PlatformAgentOption,
} from './messaging-platform-shared.ts';

const groupPolicyLabels: Record<DiscordGroupPolicy, string> = {
    allowlist: 'Allowlisted servers/channels',
    disabled: 'Disabled',
    open: 'Open',
};

const allowBotsLabels: Record<string, string> = {
    false: 'Ignore',
    mentions: 'Only when mentioned',
    true: 'Allow',
};

export function ConnectionSection({
    agentOptions,
    bindingDraft,
    disabled,
    onDraftChange,
    showAgentField,
}: {
    agentOptions: PlatformAgentOption[];
    bindingDraft: BindingDraft;
    disabled: boolean;
    onDraftChange: React.Dispatch<React.SetStateAction<BindingDraft>>;
    showAgentField: boolean;
}) {
    return (
        <section>
            <SectionHeader title="Binding" />
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow title="Enabled">
                        <Switch
                            checked={bindingDraft.enabled}
                            disabled={disabled}
                            onCheckedChange={(enabled) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    enabled,
                                }))
                            }
                        />
                    </SettingsRow>
                    <Separator />
                    {showAgentField ? (
                        <>
                            <SettingsRow title="Agent">
                                <div
                                    className={
                                        disabled ? 'pointer-events-none opacity-64' : undefined
                                    }
                                >
                                    <AgentPicker
                                        onSelect={(value) =>
                                            onDraftChange((current) => ({
                                                ...current,
                                                agentId: value,
                                            }))
                                        }
                                        options={agentOptions}
                                        value={bindingDraft.agentId}
                                    />
                                </div>
                            </SettingsRow>
                            <Separator />
                        </>
                    ) : null}
                    <SettingsRow title="Bot token">
                        <Input
                            disabled={disabled}
                            onChange={(event) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    token: event.target.value,
                                }))
                            }
                            placeholder={
                                bindingDraft.tokenConfigured
                                    ? 'Leave blank to keep existing token'
                                    : 'Discord bot token'
                            }
                            type="text"
                            value={bindingDraft.token}
                        />
                    </SettingsRow>
                </Card>
            </CardFrame>
        </section>
    );
}

export function ResponseSection({
    bindingDraft,
    disabled,
    onDraftChange,
}: {
    bindingDraft: BindingDraft;
    disabled: boolean;
    onDraftChange: React.Dispatch<React.SetStateAction<BindingDraft>>;
}) {
    return (
        <section>
            <SectionHeader title="Response Behavior" />
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    <SettingsRow title="Group policy">
                        <Select
                            disabled={disabled}
                            onValueChange={(value) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    groupPolicy: value as DiscordGroupPolicy,
                                }))
                            }
                            value={bindingDraft.groupPolicy}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select group policy">
                                    {groupPolicyLabels[bindingDraft.groupPolicy]}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(groupPolicyLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow title="Bot-authored messages">
                        <Select
                            disabled={disabled}
                            onValueChange={(value) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    allowBots: parseAllowBots(value ?? 'false'),
                                }))
                            }
                            value={formatAllowBots(bindingDraft.allowBots)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select bot message policy">
                                    {allowBotsLabels[formatAllowBots(bindingDraft.allowBots)]}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(allowBotsLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
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

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="pb-3">
            <h3 className="font-medium text-foreground text-sm">{title}</h3>
        </div>
    );
}

function formatAllowBots(value: DiscordAllowBots) {
    return value === true ? 'true' : String(value);
}

function parseAllowBots(value: string): DiscordAllowBots {
    if (value === 'true') {
        return true;
    }

    return value === 'mentions' ? 'mentions' : false;
}
