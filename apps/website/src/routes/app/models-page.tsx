import { Navigate } from 'react-router-dom';
import { appRoutes } from '../../lib/app-routes.ts';

export function ModelsPage() {
    return <Navigate replace to={appRoutes.activity} />;
}
