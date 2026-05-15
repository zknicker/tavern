import { Atom02Icon } from '@hugeicons-pro/core-stroke-rounded';
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
import { readOpenClawAgentConfigEntry } from '../openclaw-draft/agent-draft.ts';
import { useOpenClawSettingsDraft } from '../openclaw-draft/provider.tsx';

export function AgentRuntimeConfigDrawer({ agentId }: { agentId: string }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const { config } = useOpenClawSettingsDraft();
    const configEntry = readOpenClawAgentConfigEntry(config, agentId);
    const configJson = React.useMemo(
        () => (configEntry ? JSON.stringify(configEntry, null, 2) : ''),
        [configEntry]
    );

    return (
        <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
            <DrawerTrigger render={<Button aria-expanded={isOpen} size="sm" variant="outline" />}>
                <Icon icon={Atom02Icon} />
                Runtime JSON
            </DrawerTrigger>
            <DrawerPopup
                className="w-[min(96vw,56rem)] max-w-[min(96vw,56rem)]"
                showCloseButton
                variant="inset"
            >
                <DrawerHeader>
                    <DrawerTitle>OpenClaw Config</DrawerTitle>
                    <DrawerDescription className="text-sm">
                        This preview of the OpenClaw configuration is for debugging purposes. It is
                        not directly editable.
                    </DrawerDescription>
                </DrawerHeader>
                <DrawerPanel className="flex min-h-0 flex-1 flex-col p-4!" scrollable={false}>
                    {configEntry ? (
                        <SimpleCodeEditor
                            className="min-h-[min(68vh,40rem)] rounded-lg border border-border/50"
                            filePath="agent-runtime.json"
                            readOnly
                            value={configJson}
                        />
                    ) : (
                        <div className="rounded-lg border border-border/50 bg-muted/24 px-3 py-4 text-muted-foreground text-sm">
                            No runtime config entry exists for this agent in the current draft.
                        </div>
                    )}
                </DrawerPanel>
            </DrawerPopup>
        </Drawer>
    );
}
