import { Navigate } from 'react-router-dom';

export function SettingsTrackingPage() {
    return <Navigate replace to="/dashboard/settings/agent-runtime" />;
}
