import { Navigate } from 'react-router-dom';

export function SettingsPage() {
    return <Navigate replace to="/dashboard/settings/agent-runtime" />;
}
