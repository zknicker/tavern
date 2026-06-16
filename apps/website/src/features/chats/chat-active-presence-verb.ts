import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';

const activePresenceVerbs = [
    'Scrying the depths',
    'Consulting the oracle',
    'Rolling for initiative',
    'Casting the bones',
    'Reading the entrails',
    'Gazing into the orb',
    'Polishing the crystal ball',
    'Stirring the cauldron',
    'Grinding the reagents',
    'Harvesting mana',
    'Siphoning aether',
    'Aligning the stars',
    'Charting constellations',
    'Mapping the leylines',
    'Carving runes',
    'Binding tomes',
    'Cataloging spells',
    'Annotating grimoires',
    'Dusting the tomes',
    'Unfurling scrolls',
    'Deciphering glyphs',
    'Translating elvish',
    'Parleying with sprites',
    'Negotiating with dragons',
    'Bartering with goblins',
    'Haggling at the bazaar',
    'Petitioning the gods',
    'Beseeching the elders',
    'Communing with spirits',
    'Untangling fate',
    'Consulting the codex',
    'Bribing the troll',
    'Apologizing to the dragon',
    'Renegotiating dragon terms',
    'Waking the wizard',
    'Asking the wizard nicely',
    'Re-reading the prophecy',
    'Disputing the prophecy',
    'Feeding the familiar',
    'Walking the dire wolf',
    'Reasoning with the demon cat',
    "Locating the wizard's sock",
    'Counting the gold twice',
    'Recounting the gold suspiciously',
    'Tipping the bard',
    'Bribing the bard quiet',
    'Negotiating bard royalties',
    'Refilling the mana flask',
    'Mopping spilled mana',
    'Convincing the sword',
    'Oiling the squeaky portcullis',
    'Coaxing damp firewood',
    'Yelling at the campfire',
    'Relighting the eternal flame',
    'Locating north',
    'Refolding the map',
    'Asking the ghost nicely',
    'Evicting a poltergeist',
    'Filing haunting paperwork',
    'Notarizing the blood oath',
    "Reviewing the pact's fine print",
    "Lawyering the genie's wish",
    'Wording the wish carefully',
    'Checking for loopholes',
    'Herding griffons',
    'Saddling the pegasus',
    'Bribing the pegasus',
    'Coaxing out the unicorn',
    'Detangling unicorn mane',
    'Calming the spooked steed',
    'Quieting the banshee',
    'Workshopping the riddle',
    'Beta-testing the riddle',
    'Sweeping the dungeon',
    'Tidying the lair',
    'Alphabetizing the potions',
    'Labeling mystery potions',
    'Sniffing the mystery potion',
    'Regretting that sniff',
    'Identifying the cursed amulet',
    'Returning the cursed amulet',
    'Demanding a witch refund',
    "Reading the sword's warranty",
    'Updating the spellbook',
    'Patching the teleport circle',
    'Rebooting the rune array',
    'Untangling the leylines',
    'Defragmenting the grimoire',
    'Backing up the soul',
    'Restoring an earlier soul',
    'Convincing the portal',
    'Knocking on the portal',
    'Wrangling escaped imps',
    'Counting the imps',
    'Negotiating with the imp',
    'Soothing the artifact',
    'Charging the artifact',
    'Reminding the knight',
    'Motivating the hero',
    'Pondering the orb',
    'Pondering it further',
];

export function getActivePresenceVerb(seed: string) {
    return activePresenceVerbs[getActivePresenceVerbIndex(seed)] ?? activePresenceVerbs[0];
}

export function getActivePresenceVerbForSequence(seed: string, sequence: number | null) {
    const baseIndex = getActivePresenceVerbIndex(seed);
    const offset = typeof sequence === 'number' && Number.isFinite(sequence) ? sequence : 0;

    const index = (baseIndex + Math.max(0, Math.trunc(offset))) % activePresenceVerbs.length;

    return activePresenceVerbs[index] ?? activePresenceVerbs[0];
}

function getActivePresenceVerbIndex(seed: string) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }

    return hash % activePresenceVerbs.length;
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

    if (activeReply.statusSequence !== null && activeReply.statusSequence !== undefined) {
        return getActivePresenceVerbForSequence(activeReply.runId, activeReply.statusSequence);
    }

    return currentVerb ?? getActivePresenceVerb(activeReply.runId);
}
