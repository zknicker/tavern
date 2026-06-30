import { createContext } from 'react';

// A cross-window merge lands the tab near the cursor (less travel than a reorder), so it
// glides a touch longer to read at a comparable pace.
export const dockGlideMs = 320;

export interface DockEntry {
    /** The window-x the tab was released at, to glide from. */
    fromX: number;
    /** The id of the tab that just merged in from another window. */
    id: string;
}

/**
 * The tab just docked in from another window. The matching tab does a FLIP on mount —
 * glide from the release cursor into its slot — instead of the plain pop-in, so a
 * cross-window merge settles like a same-window reorder.
 */
export const DockEntryContext = createContext<DockEntry | null>(null);
