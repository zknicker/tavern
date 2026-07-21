import { SidebarRightIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { setChatSidePane, useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import {
    setPaneVisibilityOverride,
    usePaneVisibilityOverride,
} from '../../hooks/pane/use-pane-visibility.ts';
import { trpc } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';

// Shows or hides the chat's artifact pane. Visibility is presentation only —
// the pane's tab set is a Runtime record and survives a collapse untouched.
export function ChatPaneToggleButton({ chatId }: { chatId: string }) {
    const paneQuery = trpc.pane.get.useQuery({ chatId }, { enabled: chatId.length > 0 });
    const override = usePaneVisibilityOverride(chatId);
    const activeSidePane = useChatSidePane(chatId);
    // The artifact pane is only truly visible when it also holds the side-pane
    // slot — latent visibility behind an open thread still reads as hidden.
    const visible =
        activeSidePane === 'artifact' && (override ?? (paneQuery.data?.targets.length ?? 0) > 0);
    const label = visible ? 'Hide artifacts' : 'Show artifacts';

    return (
        <Button
            aria-label={label}
            className={cn(
                visible ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => {
                if (!visible) {
                    setChatSidePane(chatId, 'artifact');
                }
                setPaneVisibilityOverride(chatId, !visible);
            }}
            size="icon-sm"
            title={label}
            variant={visible ? 'secondary' : 'ghost'}
        >
            <Icon className="size-[18px]" icon={SidebarRightIcon} strokeWidth={1.8} />
        </Button>
    );
}
