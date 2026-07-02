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
    test('renders a character head with currentColor marks and authored ink by default', () => {
        const markup = renderToStaticMarkup(<AgentFace animate={false} head="knight" size={20} />);
        const paths = markup.match(/<path /g) ?? [];

        // Two eyes plus the head silhouette layers.
        expect(paths.length).toBeGreaterThanOrEqual(3);
        // Marks recolor through the svg color style; light mode keeps the authored ink.
        expect(markup).toContain('fill="currentColor"');
        expect(markup).toContain('color:#1b1b1b');
    });

    test('the ink prop tints the marks (dark-mode agent color)', () => {
        const markup = renderToStaticMarkup(
            <AgentFace animate={false} dark head="knight" ink="#194154" size={20} />
        );

        expect(markup).toContain('color:#194154');
        expect(markup).not.toContain('color:#1b1b1b');
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
