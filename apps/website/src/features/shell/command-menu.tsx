import { useEffect, useMemo, useState } from 'react';
import { useDevMode } from '../../components/dev-mode-provider.tsx';
import {
    Command,
    CommandCollection,
    CommandDialog,
    CommandDialogBackdrop,
    CommandDialogPopup,
    CommandDialogPortal,
    CommandDialogViewport,
    CommandEmpty,
    CommandGroup,
    CommandGroupLabel,
    CommandInput,
    CommandItem,
    CommandList,
} from '../../components/ui/command.tsx';

interface CommandMenuAction {
    id: string;
    label: string;
    run: () => void;
}

/**
 * Global command menu (Cmd+K / Ctrl+K). Hosts commands that have no other
 * home on the web surface — like the dev mode toggle, which the desktop app
 * exposes in its Developer menu.
 */
export function CommandMenu() {
    const [open, setOpen] = useState(false);
    const { devMode, setDevMode } = useDevMode();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                setOpen((current) => !current);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const actions = useMemo<CommandMenuAction[]>(
        () => [
            {
                id: 'toggle-dev-mode',
                label: devMode ? 'Turn Dev Mode Off' : 'Turn Dev Mode On',
                run: () => setDevMode(!devMode),
            },
        ],
        [devMode, setDevMode]
    );

    return (
        <CommandDialog onOpenChange={setOpen} open={open}>
            <CommandDialogPortal>
                <CommandDialogBackdrop />
                <CommandDialogViewport>
                    <CommandDialogPopup aria-label="Command menu">
                        <Command
                            items={actions}
                            itemToStringValue={(item) => (item as CommandMenuAction).label}
                        >
                            <CommandInput placeholder="Type a command..." />
                            <CommandList>
                                <CommandEmpty>No matching commands.</CommandEmpty>
                                <CommandGroup>
                                    <CommandGroupLabel>Developer</CommandGroupLabel>
                                    <CommandCollection>
                                        {(action: CommandMenuAction) => (
                                            <CommandItem
                                                key={action.id}
                                                onClick={() => {
                                                    action.run();
                                                    setOpen(false);
                                                }}
                                                value={action}
                                            >
                                                {action.label}
                                            </CommandItem>
                                        )}
                                    </CommandCollection>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </CommandDialogPopup>
                </CommandDialogViewport>
            </CommandDialogPortal>
        </CommandDialog>
    );
}
