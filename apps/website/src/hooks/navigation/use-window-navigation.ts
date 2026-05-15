import * as React from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
    applyWindowNavigationHistoryChange,
    createWindowNavigationHistoryState,
} from './window-navigation-state.ts';

export function useWindowNavigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const navigationType = useNavigationType();
    const [historyState, setHistoryState] = React.useState(() =>
        createWindowNavigationHistoryState(location.key)
    );
    const lastLocationKeyRef = React.useRef(location.key);

    const nextHistoryState = React.useMemo(() => {
        if (lastLocationKeyRef.current === location.key) {
            return historyState;
        }

        return applyWindowNavigationHistoryChange(historyState, {
            key: location.key,
            navigationType,
        });
    }, [historyState, location.key, navigationType]);

    React.useEffect(() => {
        if (lastLocationKeyRef.current === location.key) {
            return;
        }

        lastLocationKeyRef.current = location.key;
        setHistoryState(nextHistoryState);
    }, [location.key, nextHistoryState]);

    const canGoBack = nextHistoryState.index > 0;
    const canGoForward = nextHistoryState.index < nextHistoryState.entries.length - 1;

    return React.useMemo(
        () => ({
            canGoBack,
            canGoForward,
            goBack() {
                if (!canGoBack) {
                    return;
                }

                navigate(-1);
            },
            goForward() {
                if (!canGoForward) {
                    return;
                }

                navigate(1);
            },
        }),
        [canGoBack, canGoForward, navigate]
    );
}
