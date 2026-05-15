import { describe, expect, test } from 'bun:test';
import {
    buildAvatarBorderColor,
    buildAvatarRenderProfile,
    type RGB,
    resolveAvatarTheme,
} from './render-profile.ts';

function averageLightness([red, green, blue]: RGB) {
    return (red + green + blue) / 3;
}

describe('buildAvatarRenderProfile', () => {
    test('light mode softens the darkest palette stop and both themes keep pixels gapless', () => {
        const darkProfile = buildAvatarRenderProfile('#2563eb', () => 0.5, 'dark');
        const lightProfile = buildAvatarRenderProfile('#2563eb', () => 0.5, 'light');

        expect(averageLightness(lightProfile.palette[0])).toBeGreaterThan(
            averageLightness(darkProfile.palette[0])
        );
        expect(lightProfile.channelCap).toBeLessThan(darkProfile.channelCap);
        expect(lightProfile.pixelCornerRadiusScale).toBe(0);
        expect(lightProfile.pixelGapScale).toBe(0);
        expect(darkProfile.pixelCornerRadiusScale).toBe(0);
        expect(darkProfile.pixelGapScale).toBe(0);
    });

    test('light mode highlight stays tinted instead of blowing out to white', () => {
        const lightProfile = buildAvatarRenderProfile('#f97316', () => 0.5, 'light');

        expect(Math.max(...lightProfile.highlight)).toBeLessThan(240);
        expect(Math.min(...lightProfile.highlight)).toBeGreaterThan(150);
    });
});

describe('buildAvatarBorderColor', () => {
    test('returns a darker translucent version of the avatar color', () => {
        expect(buildAvatarBorderColor('#80a0c0')).toBe('rgba(84, 106, 127, 0.72)');
    });
});

describe('resolveAvatarTheme', () => {
    test('treats explicit light theme as light', () => {
        expect(resolveAvatarTheme('light')).toBe('light');
    });

    test('defaults unknown values to dark', () => {
        expect(resolveAvatarTheme('system')).toBe('dark');
        expect(resolveAvatarTheme(undefined)).toBe('dark');
    });
});
