import { appRoutes } from '../../lib/app-routes.ts';

export function shouldShowMainTopDragFade(pathname: string) {
    return pathname.startsWith(`${appRoutes.chats}/`);
}
