import { Navigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export function SettingsNotesMdPage() {
    return <Navigate replace to={appRoutes.members} />;
}
