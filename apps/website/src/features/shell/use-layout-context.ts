import { useOutletContext } from 'react-router-dom';
import type { AppLayoutContextValue } from '../../layout.tsx';

export function useLayoutContext() {
    return useOutletContext<AppLayoutContextValue>();
}
