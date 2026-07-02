import { appRoutes } from '../../../lib/app-routes.ts';
import { getRouteNewTabKey } from './chat-tabs-model.ts';

export function shouldShowBrowserShellSidebar(route: string) {
    const pathname = route.split('?')[0].split('#')[0];

    return (
        pathname.startsWith(appRoutes.chats) ||
        pathname.startsWith(appRoutes.overview) ||
        getRouteNewTabKey(pathname) !== null
    );
}
