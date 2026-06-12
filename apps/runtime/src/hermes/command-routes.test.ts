import { describe, expect, it } from 'vitest';
import { catalogForTavern, presentEngineDescription } from './command-routes';

describe('Tavern command catalog policy', () => {
    it('hides terminal-client and host-machine commands', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/status'),
                command('/copy'),
                command('/paste'),
                command('/image'),
                command('/quit'),
                command('/redraw'),
                command('/skin'),
                command('/indicator'),
                command('/statusbar'),
                command('/busy'),
                command('/verbose'),
                command('/snapshot'),
                command('/handoff'),
                command('/update'),
                command('/model'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/status', '/model']);
    });

    it('hides session-identity, history-rewrite, and replaced-subsystem commands', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/undo'),
                command('/resume'),
                command('/sessions'),
                command('/branch'),
                command('/title'),
                command('/save'),
                command('/memory'),
                command('/yolo'),
                command('/footer'),
                command('/voice'),
                command('/help'),
                command('/debug'),
                command('/status'),
                command('/compress'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/status', '/compress']);
    });

    it('hides commands that need client-side turn resubmission or invisible turns', () => {
        const catalog = catalogForTavern({
            commands: [
                command('/retry'),
                command('/queue'),
                command('/steer'),
                command('/background'),
                command('/goal'),
                command('/subgoal'),
                command('/stop'),
                command('/agents'),
            ],
        });

        expect(catalog.commands.map((entry) => entry.name)).toEqual(['/stop', '/agents']);
    });

    it('presents /clear and /new as Tavern session resets', () => {
        const catalog = catalogForTavern({
            commands: [
                {
                    category: 'Session',
                    description: 'Clear screen and start a new session',
                    name: '/clear',
                },
                {
                    category: 'Session',
                    description: 'Start a new session (fresh session ID + history)',
                    name: '/new',
                },
            ],
        });

        expect(catalog.commands).toEqual([
            {
                category: 'Session',
                description: 'Clear the chat and start fresh context',
                name: '/clear',
            },
            {
                category: 'Session',
                description: 'Start fresh context without clearing the chat',
                name: '/new',
            },
        ]);
    });

    it('keeps the engine name and install paths out of command descriptions', () => {
        const catalog = catalogForTavern({
            commands: [
                {
                    category: 'Tools & Skills',
                    description: 'Re-scan ~/.hermes/skills/ for newly installed or removed skills',
                    name: '/reload-skills',
                },
                {
                    category: 'Configuration',
                    description: 'Pick the personality Hermes uses for this session',
                    name: '/personality',
                },
                {
                    category: 'Info',
                    description: 'Show Hermes Agent version',
                    name: '/version',
                },
            ],
        });

        expect(catalog.commands.map((entry) => entry.description)).toEqual([
            "Re-scan the agent's skills directory for newly installed or removed skills",
            'Pick the personality the agent uses for this session',
            'Show agent engine version',
        ]);
    });

    it('passes empty descriptions through untouched', () => {
        expect(presentEngineDescription(null)).toBeNull();
        expect(presentEngineDescription('Show session info')).toBe('Show session info');
    });
});

function command(name: string) {
    return { category: 'Session', description: null, name };
}
