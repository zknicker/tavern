import { appRoutes } from '../../../lib/app-routes.ts';
import { getRouteNewTabKey } from './chat-tabs-model.ts';

// The rail (section nav + channels + DMs) belongs to the chat surface: the
// home hub and every chat. Tasks, Automations, and Wiki are full-page tools
// that replace it and bring their own layouts; back/forward and tabs are the
// way back. Settings brings its own sidebar too.
export function shouldShowBrowserShellSidebar(route: string) {
    const pathname = route.split('?')[0].split('#')[0];

    return (
        pathname.startsWith(appRoutes.chats) ||
        pathname.startsWith(appRoutes.overview) ||
        getRouteNewTabKey(pathname) !== null
    );
}
