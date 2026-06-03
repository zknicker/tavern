import type { AgentRuntimeHighlightCategory } from '@tavern/api';
import { hourMs } from './constants';

const headlines: Record<AgentRuntimeHighlightCategory, string[]> = {
    memory_saved: [
        'Fresh lore joined the shelves.',
        'The archive whispers new lore.',
        'New runes entered the ledger.',
        'A bright page found home.',
        'The shelves learned something useful.',
    ],
    quest_finished: [
        'Fresh laurels hang by firelight.',
        'The guild celebrates clean work.',
        'Another quest found its ending.',
        'Victory songs warm the rafters.',
        'A bright seal closes the ledger.',
    ],
    scheduled_run: [
        'Clockwork bells stirred the rafters.',
        'The hourglass summons fresh work.',
        'Timed scrolls marched right on.',
        'The brass rooster crowed again.',
        'Scheduled magic found its moment.',
    ],
    tool_volume: [
        'Quests are fresh on the board.',
        'The guildhall hums with finished work.',
        'Fresh sparks dance above the anvil.',
        'Ink dries on many quest slips.',
        'The toolsmiths earned their supper.',
    ],
    trouble: [
        'Red runes mark the ledger.',
        'The warding bell rings twice.',
        'A cursed ember needs tending.',
        'Smoke curls from the quest board.',
        'The barmaid eyes the omens.',
    ],
};

export function pickHeadline(category: AgentRuntimeHighlightCategory, slotStart: Date) {
    const options = headlines[category];
    const salt = category.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return options[(slotStart.getTime() / hourMs + salt) % options.length] ?? options[0];
}
