import { Add01Icon } from '@hugeicons-pro/core-duotone-rounded';
import type * as React from 'react';
import { Fragment } from 'react';
import { Card, CardFrame } from '../../../components/ui/card.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { SettingsActionRow, SettingsItem } from '../../../components/ui/settings-row.tsx';
import { DiscordBindingCard } from './discord-binding-card.tsx';
import { MessagingPlatformBindingDrawer } from './messaging-platform-binding-drawer.tsx';
import type {
    BindingDraft,
    MessagingBinding,
    PlatformAgentOption,
} from './messaging-platform-shared.ts';

export function MessagingPlatformDetail({
    agentOptions,
    bindingDraft,
    bindings,
    deleteBinding,
    deletePending,
    drawerOpen,
    isLoading,
    isAgentRuntimeAvailable,
    onDraftChange,
    onDrawerOpenChange,
    onEditBinding,
    onNewBinding,
    saveBinding,
    savePending,
    showAgentField = true,
}: {
    agentOptions: PlatformAgentOption[];
    bindingDraft: BindingDraft;
    bindings: MessagingBinding[];
    deleteBinding: (id: string) => Promise<void>;
    deletePending: boolean;
    drawerOpen: boolean;
    isLoading: boolean;
    isAgentRuntimeAvailable: boolean;
    onDraftChange: React.Dispatch<React.SetStateAction<BindingDraft>>;
    onDrawerOpenChange: (open: boolean) => void;
    onEditBinding: (binding: MessagingBinding) => void;
    onNewBinding: () => void;
    saveBinding: () => Promise<void>;
    savePending: boolean;
    showAgentField?: boolean;
}) {
    return (
        <>
            <CardFrame>
                <Card className="overflow-hidden p-0">
                    {isLoading ? (
                        <SettingsItem className="text-muted-foreground text-sm">
                            Loading bindings…
                        </SettingsItem>
                    ) : null}
                    {bindings.map((binding, index) => (
                        <Fragment key={binding.id}>
                            {isLoading || index > 0 ? <Separator /> : null}
                            <DiscordBindingCard
                                agentOptions={agentOptions}
                                binding={binding}
                                deleteBinding={deleteBinding}
                                deletePending={deletePending}
                                isAgentRuntimeAvailable={isAgentRuntimeAvailable}
                                onEditBinding={onEditBinding}
                                showAgent={showAgentField}
                            />
                        </Fragment>
                    ))}
                    {isLoading || bindings.length > 0 ? <Separator /> : null}
                    <AddConnectionRow disabled={!isAgentRuntimeAvailable} onAdd={onNewBinding} />
                </Card>
            </CardFrame>

            <MessagingPlatformBindingDrawer
                agentOptions={agentOptions}
                bindingDraft={bindingDraft}
                drawerOpen={drawerOpen}
                isAgentRuntimeAvailable={isAgentRuntimeAvailable}
                onDraftChange={onDraftChange}
                onDrawerOpenChange={onDrawerOpenChange}
                saveBinding={saveBinding}
                savePending={savePending}
                showAgentField={showAgentField}
            />
        </>
    );
}

function AddConnectionRow({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }) {
    return (
        <SettingsActionRow disabled={disabled} onClick={onAdd}>
            <Icon aria-hidden="true" className="opacity-100" icon={Add01Icon} />
            Add connection
        </SettingsActionRow>
    );
}
