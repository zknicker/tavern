import { Navigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export function SettingsTrackingPage() {
    return <Navigate replace to={appRoutes.settingsAgentRuntime} />;
}
