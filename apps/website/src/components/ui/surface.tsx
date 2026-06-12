'use client';

import * as React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * Surface elevation system (Fluid Functionalism). Eight bg/shadow token
 * pairs; containers communicate their level through context so nested
 * panels land at the right depth without prop threading. Tokens live in
 * styles/global.css; see DESIGN.md "Surfaces".
 */

const minSurfaceLevel = 1;
const maxSurfaceLevel = 8;

const SurfaceContext = React.createContext<number>(minSurfaceLevel);

export function useSurface(): number {
    return React.useContext(SurfaceContext);
}

export function SurfaceProvider({ children, value }: { children: React.ReactNode; value: number }) {
    return (
        <SurfaceContext.Provider value={clampSurfaceLevel(value)}>
            {children}
        </SurfaceContext.Provider>
    );
}

// Literal class lookups: Tailwind's static scanner cannot see template
// literals like `bg-surface-${level}`, so the utilities must appear verbatim.
const surfaceBackgrounds: Record<number, string> = {
    1: 'bg-surface-1',
    2: 'bg-surface-2',
    3: 'bg-surface-3',
    4: 'bg-surface-4',
    5: 'bg-surface-5',
    6: 'bg-surface-6',
    7: 'bg-surface-7',
    8: 'bg-surface-8',
};

const surfaceShadows: Record<number, string> = {
    1: 'shadow-surface-1',
    2: 'shadow-surface-2',
    3: 'shadow-surface-3',
    4: 'shadow-surface-4',
    5: 'shadow-surface-5',
    6: 'shadow-surface-6',
    7: 'shadow-surface-7',
    8: 'shadow-surface-8',
};

export function surfaceClasses(backgroundLevel: number, shadowLevel = backgroundLevel): string {
    return `${surfaceBackgrounds[clampSurfaceLevel(backgroundLevel)]} ${surfaceShadows[clampSurfaceLevel(shadowLevel)]}`;
}

export function Elevated({
    children,
    className,
    offset,
    ref,
    shadowLevel,
    ...props
}: React.ComponentPropsWithoutRef<'div'> & {
    /**
     * Steps above the current substrate. The element's surface level becomes
     * `min(substrate + offset, 8)` and is re-provided to descendants, so
     * deeper nesting walks up the ladder automatically. Conventional
     * offsets: 1 inline card, 2 dropdown/popover, 4 dialog.
     */
    offset: number;
    ref?: React.Ref<HTMLDivElement>;
    /**
     * Fixed shadow weight independent of nesting depth — e.g. a dropdown
     * always reads `shadow-surface-3` wherever it opens, while its
     * background still tracks the substrate.
     */
    shadowLevel?: number;
}) {
    const substrate = useSurface();
    const level = clampSurfaceLevel(substrate + offset);

    return (
        <SurfaceProvider value={level}>
            <div
                className={cn(surfaceClasses(level, shadowLevel ?? level), className)}
                ref={ref}
                {...props}
            >
                {children}
            </div>
        </SurfaceProvider>
    );
}

function clampSurfaceLevel(level: number) {
    return Math.max(minSurfaceLevel, Math.min(maxSurfaceLevel, level));
}
