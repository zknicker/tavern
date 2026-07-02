import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { appRoutes } from '../../../lib/app-routes.ts';
import { getChatAgentId } from '../../chats/chat-list-data.ts';
import { TavernTabFavicon } from './tavern-tab-favicon.tsx';
import { useActiveChat } from './use-active-chat.ts';

/**
 * Location breadcrumb for the shell toolbar: the Tavern root, then the current
 * section or chat. Chat crumbs reuse the tab favicon so a chat carries the
 * same identity mark in the tab, sidebar, and breadcrumb.
 */
export function ToolbarBreadcrumb() {
    const navigate = useNavigate();
    const { chat, descriptor } = useActiveChat();
    const isRoot =
        descriptor.kind === 'home' ||
        (descriptor.kind === 'section' && descriptor.section === 'overview');

    if (isRoot) {
        return (
            <nav aria-label="Breadcrumb" className={breadcrumbClassName}>
                <span className="text-muted-foreground">Home</span>
            </nav>
        );
    }

    return (
        <nav aria-label="Breadcrumb" className={breadcrumbClassName}>
            <button
                className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => navigate(appRoutes.overview)}
                type="button"
            >
                Home
            </button>
            <Icon
                aria-hidden="true"
                className="size-3 shrink-0 text-muted-foreground/60"
                icon={ArrowRight01Icon}
                size={12}
            />
            <span className="flex min-w-0 items-center gap-1.5 text-foreground/85">
                {chat ? (
                    <TavernTabFavicon
                        agentId={getChatAgentId(chat)}
                        busy={false}
                        color={chat.tabAppearance.color}
                        isChannel={chat.conversationKind === 'channel'}
                    />
                ) : null}
                <span className="truncate">{descriptor.title}</span>
            </span>
        </nav>
    );
}

const breadcrumbClassName = 'flex min-w-0 items-center gap-1.5 pl-1 text-[13px]';
