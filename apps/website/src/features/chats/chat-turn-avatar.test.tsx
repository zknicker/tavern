import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseUserProfile } from '../../hooks/dashboard/use-user-profile-preference.ts';
import { AgentEyes } from './agent-eyes.tsx';
import { resolveTurnAvatarVariant } from './chat-transcript-turn.tsx';

describe('turn avatar variant', () => {
    test('agents always render the Tavern eyes', () => {
        expect(resolveTurnAvatarVariant('agent', null)).toBe('eyes');
        expect(resolveTurnAvatarVariant('agent', 'data:image/png;base64,AAAA')).toBe('eyes');
    });

    test('people use an uploaded image when present, else initials', () => {
        expect(resolveTurnAvatarVariant('profile', 'data:image/png;base64,AAAA')).toBe('image');
        expect(resolveTurnAvatarVariant('profile', null)).toBe('initials');
        expect(resolveTurnAvatarVariant('participant', undefined)).toBe('initials');
    });
});

describe('static agent eyes', () => {
    test('renders both eye paths without animation in the configured color', () => {
        const markup = renderToStaticMarkup(
            <AgentEyes animated={false} color="#7658b8" size={20} />
        );
        const paths = markup.match(/<path /g) ?? [];

        expect(paths.length).toBeGreaterThanOrEqual(2);
        expect(markup).toContain('fill="#7658b8"');
    });
});

describe('user profile preference parsing', () => {
    test('round-trips a stored profile', () => {
        const raw = JSON.stringify({
            avatarUrl: 'data:image/png;base64,AAAA',
            displayName: 'Zach',
        });

        expect(parseUserProfile(raw)).toEqual({
            avatarUrl: 'data:image/png;base64,AAAA',
            displayName: 'Zach',
        });
    });

    test('falls back to empty fields for missing, partial, or invalid data', () => {
        expect(parseUserProfile(null)).toEqual({ avatarUrl: null, displayName: null });
        expect(parseUserProfile('not json')).toEqual({ avatarUrl: null, displayName: null });
        expect(parseUserProfile(JSON.stringify({ displayName: 'Zach' }))).toEqual({
            avatarUrl: null,
            displayName: 'Zach',
        });
        expect(parseUserProfile(JSON.stringify({ avatarUrl: 42, displayName: null }))).toEqual({
            avatarUrl: null,
            displayName: null,
        });
    });
});
