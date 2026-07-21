import { FileViewIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { SimpleCodeEditor } from '../../../components/code-editor/simple-code-editor.tsx';
import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
    DrawerTrigger,
} from '../../../components/ui/drawer.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { trpc } from '../../../lib/trpc.tsx';

export function AgentInstructionsPreviewDrawer({
    agentDisplayName,
    agentId,
}: {
    agentDisplayName: string;
    agentId: string;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const instructions = trpc.agent.instructions.useQuery(
        { agentId },
        {
            enabled: isOpen,
        }
    );

    function handleOpenChange(open: boolean) {
        setIsOpen(open);
    }

    return (
        <Drawer onOpenChange={handleOpenChange} open={isOpen} position="right">
            <DrawerTrigger render={<Button aria-expanded={isOpen} variant="secondary" />}>
                <Icon icon={FileViewIcon} />
                Preview system prompt
            </DrawerTrigger>
            <DrawerPopup
                className="w-[min(96vw,60rem)] max-w-[min(96vw,60rem)]"
                showCloseButton
                variant="inset"
            >
                <DrawerHeader>
                    <DrawerTitle>System Prompt Preview</DrawerTitle>
                    <DrawerDescription className="text-sm">
                        See the full instructions your agent will use, including Tavern guidance and
                        your saved custom instructions.
                    </DrawerDescription>
                </DrawerHeader>
                <DrawerPanel className="flex min-h-0 flex-1 flex-col p-4!" scrollable={false}>
                    {instructions.isPending ? (
                        <div className="flex min-h-[min(68vh,40rem)] items-center justify-center rounded-lg border border-border/50 bg-muted/24 text-muted-foreground text-sm">
                            <Spinner className="mr-2 size-4" />
                            Loading system prompt...
                        </div>
                    ) : instructions.error ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4 text-destructive text-sm">
                            {instructions.error.message}
                        </div>
                    ) : (
                        <SimpleCodeEditor
                            className="min-h-[min(68vh,40rem)] rounded-lg border border-border/50"
                            filePath="system-prompt.md"
                            readOnly
                            value={applyAgentDisplayNameToInstructions(
                                instructions.data?.content ?? '',
                                agentDisplayName
                            )}
                        />
                    )}
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}

const tavernManagedAgentLinePattern = /^You are .+?, a Grotto-managed agent\.$/mu;

export function applyAgentDisplayNameToInstructions(content: string, agentDisplayName: string) {
    const name = agentDisplayName.trim();

    if (!name) {
        return content;
    }

    return content.replace(tavernManagedAgentLinePattern, () => {
        return `You are ${name}, a Grotto-managed agent.`;
    });
}
