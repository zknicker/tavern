import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { McpCatalogList } from './mcp-catalog-list.tsx';
import { McpServersPanel } from './mcp-servers-panel.tsx';

type ToolsetView = 'catalog' | 'custom';

export function AddToolsetDialog({
    onOpenChange,
    open,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    const [view, setView] = React.useState<ToolsetView>('catalog');

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add toolset</DialogTitle>
                    <DialogDescription>
                        Install a catalog toolset or connect your own MCP server.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-4">
                    <div className="flex items-center gap-1 self-start rounded-lg bg-muted/50 p-1">
                        {(
                            [
                                { id: 'catalog', label: 'Catalog' },
                                { id: 'custom', label: 'Custom' },
                            ] as const
                        ).map((tab) => (
                            <button
                                className={`h-8 rounded-md px-3 font-medium text-sm transition-colors ${
                                    view === tab.id
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                key={tab.id}
                                onClick={() => setView(tab.id)}
                                type="button"
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {view === 'catalog' ? (
                        <McpCatalogList open={open} />
                    ) : (
                        <McpServersPanel open={open} />
                    )}
                </DialogPanel>
            </DialogContent>
        </Dialog>
    );
}
