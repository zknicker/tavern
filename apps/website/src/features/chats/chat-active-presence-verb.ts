import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';

const activePresenceVerbs = [
    'Adventuring',
    'Brewing',
    'Conjuring',
    'Scrying',
    'Questing',
    'Forging',
    'Enchanting',
    'Spellcasting',
    'Charting',
    'Delving',
    'Summoning',
    'Transmuting',
    'Wandering',
    'Wayfinding',
    'Alchemizing',
    'Incanting',
    'Rummaging',
    'Tinkering',
    'Polishing',
    'Deciphering',
    'Divining',
    'Kindling',
    'Gathering',
    'Mapping',
    'Exploring',
    'Crafting',
    'Channeling',
    'Weaving',
    'Unfurling',
    'Illuminating',
];

export function getActivePresenceVerb(seed: string) {
    let hash = 0;

    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }

    return activePresenceVerbs[hash % activePresenceVerbs.length] ?? activePresenceVerbs[0];
}

export function resolveActivePresenceVerb({
    activeReply,
    currentVerb,
}: {
    activeReply: ChatActiveReply | null;
    currentVerb: string | null;
}) {
    if (!activeReply) {
        return null;
    }

    return currentVerb ?? getActivePresenceVerb(activeReply.runId);
}
