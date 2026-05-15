import type * as React from 'react';
import {
    Drawer,
    DrawerFooter,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../../components/ui/drawer.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { ConnectionSection, ResponseSection } from './messaging-platform-binding-sections.tsx';
import { MessagingPlatformGuildsSection } from './messaging-platform-guilds-section.tsx';
import { MessagingPlatformListSection } from './messaging-platform-list-section.tsx';
import {
    type BindingDraft,
    formatCommaSeparatedIds,
    type PlatformAgentOption,
    parseCommaSeparatedIds,
} from './messaging-platform-shared.ts';

export function MessagingPlatformBindingDrawer({
    agentOptions,
    bindingDraft,
    drawerOpen,
    isAgentRuntimeAvailable,
    onDraftChange,
    onDrawerOpenChange,
    saveBinding,
    savePending,
    showAgentField = true,
}: {
    agentOptions: PlatformAgentOption[];
    bindingDraft: BindingDraft;
    drawerOpen: boolean;
    isAgentRuntimeAvailable: boolean;
    onDraftChange: React.Dispatch<React.SetStateAction<BindingDraft>>;
    onDrawerOpenChange: (open: boolean) => void;
    saveBinding: () => Promise<void>;
    savePending: boolean;
    showAgentField?: boolean;
}) {
    const canSave = Boolean(
        isAgentRuntimeAvailable &&
            bindingDraft.agentId.trim() &&
            (bindingDraft.tokenConfigured || bindingDraft.token.trim()) &&
            bindingDraft.guilds.every(
                (guild) =>
                    guild.id.trim() &&
                    guild.channelIds.every((channelId) => channelId.trim().length > 0)
            )
    );

    return (
        <Drawer onOpenChange={onDrawerOpenChange} open={drawerOpen} position="right">
            <DrawerPopup className="max-w-[600px] sm:w-[600px]" showCloseButton variant="inset">
                <Form
                    className="flex min-h-0 flex-1 flex-col gap-0"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (canSave) {
                            void saveBinding();
                        }
                    }}
                >
                    <DrawerHeader>
                        <DrawerTitle>
                            {bindingDraft.id ? 'Edit Discord Binding' : 'Add Discord Binding'}
                        </DrawerTitle>
                    </DrawerHeader>
                    <DrawerPanel className="grid gap-8">
                        <ConnectionSection
                            agentOptions={agentOptions}
                            bindingDraft={bindingDraft}
                            disabled={!isAgentRuntimeAvailable}
                            onDraftChange={onDraftChange}
                            showAgentField={showAgentField}
                        />
                        <ResponseSection
                            bindingDraft={bindingDraft}
                            disabled={!isAgentRuntimeAvailable}
                            onDraftChange={onDraftChange}
                        />
                        <MessagingPlatformGuildsSection
                            disabled={!isAgentRuntimeAvailable}
                            guilds={bindingDraft.guilds}
                            onGuildsChange={(guilds) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    guilds,
                                }))
                            }
                        />
                        <MessagingPlatformListSection
                            addLabel="New mention pattern"
                            disabled={!isAgentRuntimeAvailable}
                            emptyLabel="No mention patterns"
                            itemLabel="mention pattern"
                            onValuesChange={(values) =>
                                onDraftChange((current) => ({
                                    ...current,
                                    mentionPatterns: formatCommaSeparatedIds(values),
                                }))
                            }
                            placeholder="@atlas"
                            title="Mention Patterns"
                            values={parseCommaSeparatedIds(bindingDraft.mentionPatterns)}
                        />
                    </DrawerPanel>
                    <DrawerFooter>
                        <Button
                            onClick={() => onDrawerOpenChange(false)}
                            type="button"
                            variant="secondary"
                        >
                            Cancel
                        </Button>
                        <Button disabled={!canSave} loading={savePending} type="submit">
                            {bindingDraft.id ? 'Save changes' : 'Add binding'}
                        </Button>
                    </DrawerFooter>
                </Form>
            </DrawerPopup>
        </Drawer>
    );
}
