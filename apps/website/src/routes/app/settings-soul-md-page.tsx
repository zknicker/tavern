import { Navigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export function SettingsSoulMdPage() {
    return <Navigate replace to={appRoutes.members} />;
}
