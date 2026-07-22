import { matchPath } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export function isHumansMembersPath(pathname: string) {
    return Boolean(matchPath({ end: true, path: appRoutes.membersHumans }, pathname));
}
