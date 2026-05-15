export type AvatarTheme = 'dark' | 'light';

export type RGB = [number, number, number];

export interface AvatarRenderProfile {
    bayerOffsetColumn: number;
    bayerOffsetRow: number;
    channelCap: number;
    diagonalStripeOffset: number;
    diagonalStripeSpacing: number;
    diagonalStripeStrength: number;
    diagonalStripeThickness: number;
    highlight: RGB;
    hotMixStrength: number;
    palette: RGB[];
    pixelCornerRadiusScale: number;
    pixelGapScale: number;
    sparkleBoost: number;
    sparkleThreshold: number;
    travelWaveBoost: number;
}

export function clamp(value: number, lowerBound: number, upperBound: number) {
    return value < lowerBound ? lowerBound : value > upperBound ? upperBound : value;
}

export function hexToRgb(hex: string): RGB {
    const normalizedHex = hex.replace('#', '');
    return [
        Number.parseInt(normalizedHex.slice(0, 2), 16),
        Number.parseInt(normalizedHex.slice(2, 4), 16),
        Number.parseInt(normalizedHex.slice(4, 6), 16),
    ];
}

function darkenChannel(channel: number, amount: number) {
    return Math.round(channel * (1 - amount));
}

export function buildAvatarBorderColor(color: string) {
    const [red, green, blue] = hexToRgb(color);

    return `rgba(${darkenChannel(red, 0.34)}, ${darkenChannel(green, 0.34)}, ${darkenChannel(blue, 0.34)}, 0.72)`;
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
    const normalizedRed = red / 255;
    const normalizedGreen = green / 255;
    const normalizedBlue = blue / 255;
    const maxChannel = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const minChannel = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const lightness = (maxChannel + minChannel) / 2;

    if (maxChannel === minChannel) {
        return [0, 0, lightness];
    }

    const delta = maxChannel - minChannel;
    const saturation =
        lightness > 0.5 ? delta / (2 - maxChannel - minChannel) : delta / (maxChannel + minChannel);

    let hue = 0;
    if (maxChannel === normalizedRed) {
        hue =
            ((normalizedGreen - normalizedBlue) / delta +
                (normalizedGreen < normalizedBlue ? 6 : 0)) /
            6;
    } else if (maxChannel === normalizedGreen) {
        hue = ((normalizedBlue - normalizedRed) / delta + 2) / 6;
    } else {
        hue = ((normalizedRed - normalizedGreen) / delta + 4) / 6;
    }

    return [hue * 360, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): RGB {
    const normalizedHue = hue / 360;

    if (saturation === 0) {
        const value = Math.round(lightness * 255);
        return [value, value, value];
    }

    const hueToChannel = (p: number, q: number, channelHue: number) => {
        const normalizedChannelHue =
            channelHue < 0 ? channelHue + 1 : channelHue > 1 ? channelHue - 1 : channelHue;
        if (normalizedChannelHue < 1 / 6) {
            return p + (q - p) * 6 * normalizedChannelHue;
        }
        if (normalizedChannelHue < 1 / 2) {
            return q;
        }
        if (normalizedChannelHue < 2 / 3) {
            return p + (q - p) * (2 / 3 - normalizedChannelHue) * 6;
        }
        return p;
    };

    const q =
        lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    return [
        Math.round(hueToChannel(p, q, normalizedHue + 1 / 3) * 255),
        Math.round(hueToChannel(p, q, normalizedHue) * 255),
        Math.round(hueToChannel(p, q, normalizedHue - 1 / 3) * 255),
    ];
}

export function resolveAvatarTheme(themeValue: null | string | undefined): AvatarTheme {
    return themeValue === 'light' ? 'light' : 'dark';
}

export function buildAvatarRenderProfile(
    color: string,
    rng: () => number,
    theme: AvatarTheme
): AvatarRenderProfile {
    const [red, green, blue] = hexToRgb(color);
    const [hue, saturation, lightness] = rgbToHsl(red, green, blue);

    if (theme === 'light') {
        const deepSaturation = clamp(saturation * 0.58 + 0.06, 0.14, 0.56);
        const midSaturation = clamp(saturation * 0.5 + 0.05, 0.12, 0.48);
        const lightSaturation = clamp(saturation * 0.42 + 0.04, 0.1, 0.4);
        const highlightSaturation = clamp(saturation * 0.34 + 0.04, 0.08, 0.3);

        const palette = [
            hslToRgb(
                hue,
                deepSaturation,
                clamp(0.39 + lightness * 0.18 + rng() * 0.03, 0.37, 0.49)
            ),
            hslToRgb(hue, midSaturation, clamp(0.57 + lightness * 0.14 + rng() * 0.04, 0.55, 0.69)),
            hslToRgb(
                hue,
                lightSaturation,
                clamp(0.75 + lightness * 0.1 + rng() * 0.03, 0.73, 0.84)
            ),
        ] satisfies RGB[];

        return {
            bayerOffsetColumn: Math.floor(rng() * 8),
            bayerOffsetRow: Math.floor(rng() * 8),
            channelCap: 234,
            diagonalStripeOffset: Math.floor(rng() * 7) - 3,
            diagonalStripeSpacing: 3 + Math.floor(rng() * 2),
            diagonalStripeStrength: 0.05 + rng() * 0.02,
            diagonalStripeThickness: 1 + Math.floor(rng() * 2),
            highlight: hslToRgb(
                hue,
                highlightSaturation,
                clamp(0.84 + lightness * 0.05 + rng() * 0.02, 0.82, 0.9)
            ),
            hotMixStrength: 0.4,
            palette,
            pixelCornerRadiusScale: 0,
            pixelGapScale: 0,
            sparkleBoost: 54,
            sparkleThreshold: 0.3,
            travelWaveBoost: 18,
        };
    }

    const saturationMultiplier = 0.55 + rng() * 0.1;
    const palette = [
        hslToRgb(hue, Math.min(1, saturation * saturationMultiplier), 0.15 + rng() * 0.04),
        hslToRgb(hue, Math.min(1, saturation * (saturationMultiplier + 0.05)), 0.34 + rng() * 0.06),
        hslToRgb(hue, Math.min(1, saturation * (saturationMultiplier + 0.08)), 0.55 + rng() * 0.08),
    ] satisfies RGB[];

    return {
        bayerOffsetColumn: Math.floor(rng() * 8),
        bayerOffsetRow: Math.floor(rng() * 8),
        channelCap: 255,
        diagonalStripeOffset: Math.floor(rng() * 9) - 4,
        diagonalStripeSpacing: 3 + Math.floor(rng() * 3),
        diagonalStripeStrength: 0.09 + rng() * 0.04,
        diagonalStripeThickness: 1 + Math.floor(rng() * 2),
        highlight: hslToRgb(hue, Math.min(1, saturation * 0.35 + 0.1), 0.86),
        hotMixStrength: 0.7,
        palette,
        pixelCornerRadiusScale: 0,
        pixelGapScale: 0,
        sparkleBoost: 200,
        sparkleThreshold: 0.15,
        travelWaveBoost: 70,
    };
}
