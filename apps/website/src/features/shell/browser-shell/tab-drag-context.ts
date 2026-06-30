import { createContext } from 'react';

/**
 * The id of the tab currently lifted into the drag overlay — held through the drop
 * animation (not just while `isDragging`), so the original placeholder stays hidden and
 * inactive until the overlay finishes gliding into its slot.
 */
export const TabDragContext = createContext<string | null>(null);
