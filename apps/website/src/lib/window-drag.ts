import { getDesktopBridge } from './desktop-bridge.ts';

const windowDragBlockSelector = [
    '.no-drag',
    'button',
    'input',
    'textarea',
    'select',
    'option',
    'a[href]',
    '[role="button"]',
    '[role="tab"]',
    '[contenteditable="true"]',
    '[data-window-drag-disabled]',
].join(', ');

type WindowDragTarget = Pick<Element, 'closest'>;

export function canStartWindowDrag(target: WindowDragTarget | null | undefined) {
    return target?.closest(windowDragBlockSelector) == null;
}

export async function startCurrentWindowDrag() {
    await getDesktopBridge()?.startWindowDrag();
}

export async function setCurrentWindowTheme(theme: 'dark' | 'light' | null) {
    await getDesktopBridge()?.setTheme(theme);
}
