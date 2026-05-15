import { useOutletContext } from 'react-router-dom';
import type { DashboardLayoutContextValue } from '../../layout.tsx';

export function useLayoutContext() {
    return useOutletContext<DashboardLayoutContextValue>();
}
