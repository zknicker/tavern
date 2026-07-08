import { Bug01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { trpc } from '../../../lib/trpc.tsx';

/**
 * Dev toolkit menu: development-stack-only helpers for exercising live chat
 * surfaces. The toolbar renders it only when the runtime reports the
 * devToolkit capability and a chat is active. Simulated turns stream through
 * the normal runtime projection, so the status row, turn drawer, and pane
 * behave exactly as they do for a real model turn.
 */
export function ToolbarDevMenu({ chatId }: { chatId: string }) {
    const simulateTurn = trpc.dev.simulateTurn.useMutation();

    return (
        <Menu>
            <MenuTrigger
                render={
                    <Button
                        aria-label="Dev toolkit"
                        className="text-muted-foreground hover:text-foreground"
                        size="icon-sm"
                        title="Dev toolkit"
                        variant="ghost"
                    />
                }
            >
                <Icon className="size-[17px]" icon={Bug01Icon} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuPopup align="end">
                <MenuItem onClick={() => simulateTurn.mutate({ chatId, scenario: 'tooling' })}>
                    Simulate agent turn
                </MenuItem>
                <MenuItem onClick={() => simulateTurn.mutate({ chatId, scenario: 'narration' })}>
                    Simulate long turn
                </MenuItem>
                <MenuItem onClick={() => simulateTurn.mutate({ chatId, scenario: 'multi-agent' })}>
                    Simulate multi-agent turn
                </MenuItem>
                <MenuItem onClick={() => simulateTurn.mutate({ chatId, scenario: 'failure' })}>
                    Simulate failed turn
                </MenuItem>
            </MenuPopup>
        </Menu>
    );
}
