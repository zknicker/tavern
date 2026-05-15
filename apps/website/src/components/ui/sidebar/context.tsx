'use client';

import * as React from 'react';

const SIDEBAR_STORAGE_KEY = 'sidebar_state';
const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar_width';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
const MOBILE_BREAKPOINT = 768;
const DEFAULT_SIDEBAR_WIDTH = 276;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 380;

export const SIDEBAR_WIDTH = `${DEFAULT_SIDEBAR_WIDTH}px`;
export const SIDEBAR_WIDTH_MOBILE = '18rem';
export const SIDEBAR_WIDTH_ICON = '3.25rem';

interface SidebarContextProps {
    isMobile: boolean;
    open: boolean;
    openMobile: boolean;
    persistSidebarWidth: (width: number) => void;
    setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
    setOpenMobile: (open: boolean) => void;
    setSidebarWidth: (width: number) => void;
    sidebarWidth: number;
    state: 'expanded' | 'collapsed';
    toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export function useSidebar() {
    const context = React.useContext(SidebarContext);

    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider.');
    }

    return context;
}

function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const update = () => setIsMobile(query.matches);

        update();
        query.addEventListener('change', update);

        return () => query.removeEventListener('change', update);
    }, []);

    return isMobile;
}

function clampSidebarWidth(width: number) {
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

function getInitialSidebarWidth() {
    if (typeof window === 'undefined') {
        return DEFAULT_SIDEBAR_WIDTH;
    }

    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));

    return Number.isFinite(saved) ? clampSidebarWidth(saved) : DEFAULT_SIDEBAR_WIDTH;
}

export function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [sidebarWidth, setSidebarWidthState] = React.useState(getInitialSidebarWidth);
    const [_open, _setOpen] = React.useState(() => {
        if (typeof window === 'undefined') {
            return defaultOpen;
        }

        const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);

        return saved === null ? defaultOpen : saved === 'true';
    });
    const open = openProp ?? _open;

    const setOpen = React.useCallback(
        (value: boolean | ((value: boolean) => boolean)) => {
            const nextOpen = typeof value === 'function' ? value(open) : value;

            if (setOpenProp) {
                setOpenProp(nextOpen);
            } else {
                _setOpen(nextOpen);
            }

            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextOpen));
        },
        [open, setOpenProp]
    );

    const setSidebarWidth = React.useCallback((width: number) => {
        const nextWidth = clampSidebarWidth(width);

        setSidebarWidthState(nextWidth);
    }, []);

    const persistSidebarWidth = React.useCallback((width: number) => {
        const nextWidth = clampSidebarWidth(width);

        setSidebarWidthState(nextWidth);
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
    }, []);

    const toggleSidebar = React.useCallback(() => {
        if (isMobile) {
            setOpenMobile((current) => !current);
            return;
        }

        setOpen((current) => !current);
    }, [isMobile, setOpen]);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                toggleSidebar();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? 'expanded' : 'collapsed';
    const contextValue = React.useMemo<SidebarContextProps>(
        () => ({
            isMobile,
            open,
            openMobile,
            persistSidebarWidth,
            setOpen,
            setOpenMobile,
            setSidebarWidth,
            sidebarWidth,
            state,
            toggleSidebar,
        }),
        [
            isMobile,
            open,
            openMobile,
            persistSidebarWidth,
            setOpen,
            setSidebarWidth,
            sidebarWidth,
            state,
            toggleSidebar,
        ]
    );

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                className={className}
                data-slot="sidebar-wrapper"
                style={
                    {
                        '--sidebar-width': `${sidebarWidth}px`,
                        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                        ...style,
                    } as React.CSSProperties
                }
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    );
}
