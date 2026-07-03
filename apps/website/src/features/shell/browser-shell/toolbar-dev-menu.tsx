import { Wrench01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { useActiveChat } from './use-active-chat.ts';

/**
 * Dev toolkit menu: development-stack-only helpers for exercising live chat
 * surfaces. Rendered only when the runtime reports the devToolkit capability
 * and a chat is active. Simulated turns stream through the normal runtime
 * projection, so the status row, turn drawer, and pane behave exactly as they
 * do for a real model turn.
 */
export function ToolbarDevMenu() {
    const gate = useCapability('devToolkit');
    const { chat } = useActiveChat();
    const simulateTurn = trpc.dev.simulateTurn.useMutation();

    if (!(gate.healthy && chat)) {
        return null;
    }

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
                <Icon className="size-[17px]" icon={Wrench01Icon} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuPopup align="end">
                <MenuItem
                    onClick={() => simulateTurn.mutate({ chatId: chat.id, scenario: 'tooling' })}
                >
                    Simulate agent turn
                </MenuItem>
                <MenuItem
                    onClick={() => simulateTurn.mutate({ chatId: chat.id, scenario: 'failure' })}
                >
                    Simulate failed turn
                </MenuItem>
            </MenuPopup>
        </Menu>
    );
}
