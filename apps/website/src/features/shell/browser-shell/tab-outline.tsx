import { buildShellOutlinePath, CARD_R } from './geometry.ts';
import { useShell } from './shell-context.tsx';

/**
 * The single continuous hairline for the whole shell top — card corners, strip/toolbar
 * boundary, and up-and-around the live-measured active tab — drawn as ONE stroked path
 * so the tab outline and the shell's top edge are literally the same line.
 */
export function TabOutline() {
    const { meta } = useShell();
    const o = meta.outline;

    if (!o) {
        return null;
    }

    const height = o.boundaryY + CARD_R + 2;

    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-40 overflow-visible"
            height={height}
            viewBox={`0 0 ${o.w} ${height}`}
            width={o.w}
        >
            <path
                d={buildShellOutlinePath(o)}
                fill="none"
                stroke="var(--browser-hairline)"
                strokeWidth="1"
            />
        </svg>
    );
}
