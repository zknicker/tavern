export function isSelectAllShortcut(event: {
    altKey?: boolean;
    ctrlKey?: boolean;
    key: string;
    metaKey?: boolean;
    shiftKey?: boolean;
}) {
    return (
        event.key.toLowerCase() === 'a' &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
    );
}

export function isEditableSelectAllTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return false;
    }

    const editable = target.closest('input, textarea, [contenteditable]');

    if (!editable) {
        return false;
    }

    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
        return !(editable.disabled || editable.readOnly);
    }

    return true;
}

export function shouldKeepPointerFocus(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(
        target.closest('button, a, input, select, textarea, [contenteditable], [role="button"]')
    );
}

export function selectElementContents(element: HTMLElement | null) {
    if (!element) {
        return false;
    }

    const selection = element.ownerDocument.getSelection();

    if (!selection) {
        return false;
    }

    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}
