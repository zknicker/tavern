async function writeWithClipboardApi(value: string) {
    if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable.');
    }

    await navigator.clipboard.writeText(value);
}

export async function writeClipboardText(value: string) {
    const textarea = document.createElement('textarea');
    const selection = document.getSelection();
    const previousRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    textarea.setAttribute('readonly', 'true');
    textarea.style.left = '-9999px';
    textarea.style.position = 'fixed';
    textarea.value = value;

    try {
        try {
            await writeWithClipboardApi(value);
            return;
        } catch {
            // Fall back to a direct DOM copy when async clipboard writes lose user activation.
        }

        document.body.append(textarea);
        textarea.select();

        const copied = document.execCommand('copy');
        if (!copied) {
            throw new Error('Clipboard API unavailable.');
        }
    } finally {
        textarea.remove();

        if (selection) {
            selection.removeAllRanges();
            if (previousRange) {
                selection.addRange(previousRange);
            }
        }
    }
}
