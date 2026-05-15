import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
    if (!isTauri()) {
        return;
    }

    await getCurrentWindow().startDragging();
}

export async function setCurrentWindowTheme(theme: 'dark' | 'light' | null) {
    if (!isTauri()) {
        return;
    }

    await getCurrentWindow().setTheme(theme);
}
