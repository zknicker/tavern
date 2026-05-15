const senderColors = [
    'text-[var(--sender-1)]',
    'text-[var(--sender-2)]',
    'text-[var(--sender-3)]',
    'text-[var(--sender-4)]',
    'text-[var(--sender-5)]',
    'text-[var(--sender-6)]',
    'text-[var(--sender-7)]',
    'text-[var(--sender-8)]',
];

const senderCssVars = [
    '--sender-1',
    '--sender-2',
    '--sender-3',
    '--sender-4',
    '--sender-5',
    '--sender-6',
    '--sender-7',
    '--sender-8',
];

function hashSender(sender: string) {
    let hash = 0;

    for (let index = 0; index < sender.length; index += 1) {
        hash = (hash * 31 + sender.charCodeAt(index)) % Number.MAX_SAFE_INTEGER;
    }

    return Math.abs(hash);
}

export function getSenderColor(sender: string) {
    return senderColors[hashSender(sender) % senderColors.length];
}

export function getSenderCssVar(sender: string) {
    return senderCssVars[hashSender(sender) % senderCssVars.length];
}
