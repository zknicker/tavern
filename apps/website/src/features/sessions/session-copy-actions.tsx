import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../../components/ui/menu.tsx';
import { useSessionCopyActions } from './use-session-copy-actions.ts';

export function SessionCopyActions({
    historyOffset,
    limit,
    sessionId,
    sessionKey,
}: {
    historyOffset: number | null;
    limit: number;
    sessionId: string;
    sessionKey: string;
}) {
    const { copyAllAction, copyHistoryAction, copySessionIdAction } = useSessionCopyActions({
        historyOffset,
        limit,
        sessionId,
        sessionKey,
    });

    return (
        <Menu>
            <MenuTrigger
                render={
                    <button
                        aria-label="Session actions"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
                        type="button"
                    />
                }
            >
                <Icon className="size-4" icon={MoreVerticalIcon} />
            </MenuTrigger>
            <MenuPopup align="end">
                <MenuItem onClick={copySessionIdAction}>Copy session ID</MenuItem>
                <MenuItem onClick={copyHistoryAction}>Copy history</MenuItem>
                <MenuItem onClick={copyAllAction}>Copy full session</MenuItem>
            </MenuPopup>
        </Menu>
    );
}
