import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseUserProfile } from '../../hooks/shell/use-user-profile-preference.ts';
import { AgentFace } from './agent-face.tsx';
import { resolveTurnAvatarVariant } from './chat-transcript-turn.tsx';

describe('turn avatar variant', () => {
    test('agents always render the Tavern character face', () => {
        expect(resolveTurnAvatarVariant('agent', null)).toBe('eyes');
        expect(resolveTurnAvatarVariant('agent', 'data:image/png;base64,AAAA')).toBe('eyes');
    });

    test('people use an uploaded image when present, else initials', () => {
        expect(resolveTurnAvatarVariant('profile', 'data:image/png;base64,AAAA')).toBe('image');
        expect(resolveTurnAvatarVariant('profile', null)).toBe('initials');
        expect(resolveTurnAvatarVariant('participant', undefined)).toBe('initials');
    });
});

describe('static agent face', () => {
    test('renders a character head with both eyes and no color tint', () => {
        const markup = renderToStaticMarkup(<AgentFace animated={false} head="knight" size={20} />);
        const paths = markup.match(/<path /g) ?? [];

        // Two eyes plus the head silhouette layers.
        expect(paths.length).toBeGreaterThanOrEqual(3);
        // Agent color must not tint the avatar; eyes use the head's ink/paper.
        expect(markup).toContain('fill="#1b1b1b"');
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
