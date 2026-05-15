import { Navigate } from 'react-router-dom';

export function TrackingPage() {
    return <Navigate replace to="/dashboard/settings/agent-runtime" />;
}
