import type { AvatarEmote } from './agent-avatar.tsx';
import { type AvatarRenderProfile, buildAvatarRenderProfile, clamp } from './render-profile.ts';

interface Particle {
    b: number;
    baseSize: number;
    g: number;
    homeX: number;
    homeY: number;
    nd: number;
    phaseX: number;
    phaseY: number;
    r: number;
    size: number;
    speed: number;
    x: number;
    y: number;
}

const bayerMatrix8 = [
    0 / 64,
    32 / 64,
    8 / 64,
    40 / 64,
    2 / 64,
    34 / 64,
    10 / 64,
    42 / 64,
    48 / 64,
    16 / 64,
    56 / 64,
    24 / 64,
    50 / 64,
    18 / 64,
    58 / 64,
    26 / 64,
    12 / 64,
    44 / 64,
    4 / 64,
    36 / 64,
    14 / 64,
    46 / 64,
    6 / 64,
    38 / 64,
    60 / 64,
    28 / 64,
    52 / 64,
    20 / 64,
    62 / 64,
    30 / 64,
    54 / 64,
    22 / 64,
    3 / 64,
    35 / 64,
    11 / 64,
    43 / 64,
    1 / 64,
    33 / 64,
    9 / 64,
    41 / 64,
    51 / 64,
    19 / 64,
    59 / 64,
    27 / 64,
    49 / 64,
    17 / 64,
    57 / 64,
    25 / 64,
    15 / 64,
    47 / 64,
    7 / 64,
    39 / 64,
    13 / 64,
    45 / 64,
    5 / 64,
    37 / 64,
    63 / 64,
    31 / 64,
    55 / 64,
    23 / 64,
    61 / 64,
    29 / 64,
    53 / 64,
    21 / 64,
];

function squirclePath(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    halfWidth: number,
    halfHeight: number,
    exponent = 4
) {
    const steps = 100;
    context.beginPath();
    for (let index = 0; index <= steps; index++) {
        const angle = (index / steps) * 2 * Math.PI;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const pointX = centerX + Math.sign(cosine) * halfWidth * Math.abs(cosine) ** (2 / exponent);
        const pointY = centerY + Math.sign(sine) * halfHeight * Math.abs(sine) ** (2 / exponent);

        if (index === 0) {
            context.moveTo(pointX, pointY);
        } else {
            context.lineTo(pointX, pointY);
        }
    }
    context.closePath();
}

function mixChannel(source: number, target: number, amount: number) {
    return source + (target - source) * amount;
}

export function resolveGradientProgress(input: {
    column: number;
    columns: number;
    stripeOffset: number;
    stripeSpacing: number;
    stripeStrength: number;
    stripeThickness: number;
    row: number;
    rows: number;
}) {
    const diagonalSpan = Math.max(1, input.columns + input.rows - 2);
    const gradientDiagonalIndex = input.column + input.row;
    const diagonalProgress = gradientDiagonalIndex / diagonalSpan;
    const stripeDiagonalIndex = input.column - input.row;
    const normalizedStripeIndex =
        (((stripeDiagonalIndex + input.stripeOffset) % input.stripeSpacing) + input.stripeSpacing) %
        input.stripeSpacing;
    const inStripe = normalizedStripeIndex < input.stripeThickness;
    const stripeJitter = inStripe ? input.stripeStrength : -input.stripeStrength * 0.45;

    return clamp(diagonalProgress + stripeJitter, 0, 1);
}

export function generateParticles(input: {
    color: string;
    height: number;
    rng: () => number;
    theme: 'dark' | 'light';
    width: number;
}) {
    const renderProfile = buildAvatarRenderProfile(input.color, input.rng, input.theme);
    const pixelSize = Math.max(4, Math.round(input.width / 5));
    const gap =
        renderProfile.pixelGapScale <= 0
            ? 0
            : Math.max(1, Math.round(pixelSize * renderProfile.pixelGapScale));
    const columns = Math.ceil(input.width / pixelSize);
    const rows = Math.ceil(input.height / pixelSize);
    const particles: Particle[] = [];

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const x = column * pixelSize;
            const y = row * pixelSize;
            const normalizedX = (x + pixelSize / 2) / input.width;
            const normalizedY = (y + pixelSize / 2) / input.height;
            const gradientT = resolveGradientProgress({
                column,
                columns,
                stripeOffset: renderProfile.diagonalStripeOffset,
                stripeSpacing: renderProfile.diagonalStripeSpacing,
                stripeStrength: renderProfile.diagonalStripeStrength,
                stripeThickness: renderProfile.diagonalStripeThickness,
                row,
                rows,
            });
            const palettePosition = gradientT * (renderProfile.palette.length - 1);
            const paletteIndex = Math.floor(palettePosition);
            const paletteFraction = palettePosition - paletteIndex;

            const threshold =
                bayerMatrix8[
                    ((row + renderProfile.bayerOffsetRow) % 8) * 8 +
                        ((column + renderProfile.bayerOffsetColumn) % 8)
                ];
            const colorA =
                renderProfile.palette[Math.min(paletteIndex, renderProfile.palette.length - 1)];
            const colorB =
                renderProfile.palette[Math.min(paletteIndex + 1, renderProfile.palette.length - 1)];
            const rgb = paletteFraction > threshold ? colorB : colorA;

            const noise = (input.rng() - 0.5) * (input.theme === 'light' ? 4 : 6);
            const particleRed = clamp(rgb[0] + noise, 0, 255);
            const particleGreen = clamp(rgb[1] + noise, 0, 255);
            const particleBlue = clamp(rgb[2] + noise, 0, 255);

            const distanceX = normalizedX - 0.5;
            const distanceY = normalizedY - 0.5;
            const normalizedDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY) * 2;

            const homeX = Math.round(x + gap);
            const homeY = Math.round(y + gap);
            const baseSize = Math.round(pixelSize - gap * 2);

            particles.push({
                b: particleBlue,
                baseSize,
                g: particleGreen,
                homeX,
                homeY,
                nd: normalizedDistance,
                phaseX: input.rng() * Math.PI * 2,
                phaseY: input.rng() * Math.PI * 2,
                r: particleRed,
                size: baseSize,
                speed: 0.8 + input.rng() * 1.2,
                x: homeX,
                y: homeY,
            });
        }
    }

    return {
        particles,
        renderProfile,
    };
}

/* ────────────────────────── Face system ────────────────────── */

/**
 * Parameterised face shape — all values are fractions of canvas dimensions
 * so they can be smoothly interpolated between emotes.
 */
export interface FaceParams {
    /** 0 = rounded rect eyes, 1 = arc/curved stroke eyes */
    arcEyes: number;
    /** Eye tilt in radians — positive tilts inner edges down (^ shape) */
    eyeTilt: number;
    /** Half-gap between inner eye edges as fraction of canvasWidth */
    gap: number;
    /** Eye height as fraction of canvasHeight */
    h: number;
    /** Mouth curvature: 1 = full smile, 0 = flat, -1 = frown */
    mouthCurve: number;
    /** Mouth openness: 0 = thin stroke, 1 = open filled mouth */
    mouthOpen: number;
    /** Mouth width as fraction of canvasWidth (0 = no mouth) */
    mouthW: number;
    /** Mouth vertical offset from center as fraction of canvasHeight */
    mouthY: number;
    /** Corner-radius factor — applied to min(w, h) in pixels */
    r: number;
    /** Sleepiness: 0 = awake, 1 = sleeping (controls Z particles) */
    sleepiness: number;
    /** Eye width as fraction of canvasWidth */
    w: number;
    /** Vertical offset from center as fraction of canvasHeight (negative = up) */
    y: number;
}

const EMOTE_TARGETS: Record<AvatarEmote, FaceParams> = {
    idle: {
        w: 0.17,
        h: 0.3,
        r: 0.42,
        y: -0.04,
        gap: 0.07,
        arcEyes: 0,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: 0,
        sleepiness: 0,
    },
    happy: {
        w: 0.22,
        h: 0.08,
        r: 0.42,
        y: -0.12,
        gap: 0.1,
        arcEyes: 1,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: 0,
        sleepiness: 0,
    },
    focused: {
        w: 0.3,
        h: 0.13,
        r: 0.38,
        y: -0.04,
        gap: 0.05,
        arcEyes: 0,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: 0.18,
        sleepiness: 0,
    },
    surprised: {
        w: 0.3,
        h: 0.36,
        r: 0.5,
        y: -0.04,
        gap: 0.04,
        arcEyes: 0,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: -0.14,
        sleepiness: 0,
    },
    sleepy: {
        w: 0.26,
        h: 0.1,
        r: 0.42,
        y: -0.01,
        gap: 0.07,
        arcEyes: 0,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: 0,
        sleepiness: 1,
    },
};

export function getEmoteTarget(emote: AvatarEmote): FaceParams {
    return { ...EMOTE_TARGETS[emote] };
}

/* ────────────────────────── Spring physics ────────────────────── */

/** Velocity state that mirrors FaceParams — tracks per-property velocity */
export type FaceVelocity = Record<keyof FaceParams, number>;

export function zeroVelocity(): FaceVelocity {
    return {
        w: 0,
        h: 0,
        r: 0,
        y: 0,
        gap: 0,
        arcEyes: 0,
        mouthW: 0,
        mouthY: 0,
        mouthCurve: 0,
        mouthOpen: 0,
        eyeTilt: 0,
        sleepiness: 0,
    };
}

interface SpringConfig {
    damping: number;
    stiffness: number;
}

/**
 * Per-property spring configs — different feel for different aspects of the face.
 * Size params (w, h) are bouncier for a squash-and-stretch feel.
 * Position params (y, gap) are snappy.
 * Shape params (arcEyes, eyeTilt) are smooth.
 */
const SPRING_CONFIGS: Record<keyof FaceParams, SpringConfig> = {
    w: { stiffness: 200, damping: 12 }, // bouncy squash-stretch
    h: { stiffness: 200, damping: 12 }, // bouncy squash-stretch
    r: { stiffness: 220, damping: 14 }, // shape with slight bounce
    y: { stiffness: 250, damping: 15 }, // snappy position
    gap: { stiffness: 250, damping: 15 }, // snappy position
    arcEyes: { stiffness: 220, damping: 13 }, // blend with bounce
    mouthW: { stiffness: 210, damping: 12 }, // expressive
    mouthY: { stiffness: 250, damping: 15 }, // snappy position
    mouthCurve: { stiffness: 210, damping: 12 }, // expressive
    mouthOpen: { stiffness: 210, damping: 12 }, // expressive
    eyeTilt: { stiffness: 180, damping: 10 }, // wobbly tilt
    sleepiness: { stiffness: 150, damping: 14 }, // gentle fade
};

const FACE_KEYS: (keyof FaceParams)[] = [
    'w',
    'h',
    'r',
    'y',
    'gap',
    'arcEyes',
    'mouthW',
    'mouthY',
    'mouthCurve',
    'mouthOpen',
    'eyeTilt',
    'sleepiness',
];

/**
 * Advance spring physics for all face params.
 * Mutates `current` and `velocity` in place. Returns true if still moving.
 */
export function springFaceParams(
    current: FaceParams,
    velocity: FaceVelocity,
    target: FaceParams,
    dt: number
): boolean {
    const eps = 0.0005;
    let settled = true;

    for (const key of FACE_KEYS) {
        const spring = SPRING_CONFIGS[key];
        const displacement = current[key] - target[key];
        const springForce = -spring.stiffness * displacement;
        const dampingForce = -spring.damping * velocity[key];
        const acceleration = springForce + dampingForce;

        velocity[key] += acceleration * dt;
        current[key] += velocity[key] * dt;

        if (Math.abs(displacement) > eps || Math.abs(velocity[key]) > eps) {
            settled = false;
        } else {
            // Snap to target when close enough
            current[key] = target[key];
            velocity[key] = 0;
        }
    }

    return !settled;
}

function drawFace(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    canvasWidth: number,
    canvasHeight: number,
    p: FaceParams,
    blinkTime: number,
    _time: number
) {
    const blinkDuration = 0.15;
    let blinkScale = 1.0;
    if (blinkTime >= 0 && blinkTime < blinkDuration) {
        blinkScale = Math.abs(Math.cos((blinkTime / blinkDuration) * Math.PI));
    }

    const ew = p.w * canvasWidth;
    const eyeCenterY = centerY + p.y * canvasHeight;
    const gap = p.gap * canvasWidth;
    const leftEyeCX = centerX - gap - ew / 2;
    const rightEyeCX = centerX + gap + ew / 2;

    const fillColor = 'rgba(255, 255, 255, 0.92)';
    ctx.fillStyle = fillColor;

    const arc = p.arcEyes;

    /* ── Rounded rect eyes ── */
    if (arc < 0.99) {
        const maxEh = p.h * canvasHeight;
        const eh = Math.max(ew * 0.18, maxEh * blinkScale);
        const er = Math.min(p.r * ew, p.r * eh);

        ctx.globalAlpha = 1 - arc;
        ctx.fillStyle = fillColor;

        // Left eye — tilt clockwise (inner edge dips down)
        ctx.save();
        ctx.translate(leftEyeCX, eyeCenterY);
        ctx.rotate(p.eyeTilt);
        ctx.beginPath();
        ctx.roundRect(-ew / 2, -eh / 2, ew, eh, er);
        ctx.fill();
        ctx.restore();

        // Right eye — tilt counter-clockwise (mirror ^)
        ctx.save();
        ctx.translate(rightEyeCX, eyeCenterY);
        ctx.rotate(-p.eyeTilt);
        ctx.beginPath();
        ctx.roundRect(-ew / 2, -eh / 2, ew, eh, er);
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = 1;
    }

    /* ── Arc eyes (thick noodle ∩ strokes) ── */
    if (arc > 0.01) {
        const arcSpan = canvasWidth * 0.1;
        const arcRise = canvasHeight * 0.16;
        // Happy "blink" — rise with ease-out, then bouncy settle
        let arcBlinkOffset = 0;
        const arcBlinkDuration = 0.8;
        if (blinkTime >= 0 && blinkTime < arcBlinkDuration) {
            const riseDur = 0.18;
            if (blinkTime < riseDur) {
                // Ease-out rise
                const t = blinkTime / riseDur;
                arcBlinkOffset = (1 - (1 - t) * (1 - t)) * canvasHeight * -0.06;
            } else {
                // Damped bounce settle
                const bt = blinkTime - riseDur;
                const freq = 14;
                const decay = 5.5;
                const bounce = Math.exp(-decay * bt) * Math.cos(freq * bt);
                arcBlinkOffset = bounce * canvasHeight * -0.06;
            }
        }
        const strokeW = Math.max(5, canvasWidth * 0.13);

        ctx.globalAlpha = arc;
        ctx.strokeStyle = fillColor;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';

        const arcAngles = [(-4 * Math.PI) / 180, (4 * Math.PI) / 180];
        const centers = [leftEyeCX, rightEyeCX];

        for (let i = 0; i < 2; i++) {
            const ex = centers[i];
            const angle = arcAngles[i];
            const baseY = eyeCenterY + arcRise * 0.3 + arcBlinkOffset;
            const peakY = eyeCenterY - arcRise + arcBlinkOffset;

            ctx.save();
            ctx.translate(ex, eyeCenterY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-arcSpan, baseY - eyeCenterY);
            ctx.quadraticCurveTo(0, peakY - eyeCenterY, arcSpan, baseY - eyeCenterY);
            ctx.stroke();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    /* ── Mouth ── */
    if (p.mouthW > 0.005) {
        const mw = p.mouthW * canvasWidth;
        const mouthCenterY = centerY + p.mouthY * canvasHeight;
        const curveDepth = p.mouthCurve * canvasHeight * 0.1;
        const strokeW = Math.max(2, canvasWidth * 0.03);

        ctx.strokeStyle = fillColor;
        ctx.fillStyle = fillColor;
        ctx.lineCap = 'round';
        ctx.lineWidth = strokeW;

        const mLeftX = centerX - mw / 2;
        const mRightX = centerX + mw / 2;
        const cpY = mouthCenterY + curveDepth;

        // Smile/frown curve stroke
        ctx.beginPath();
        ctx.moveTo(mLeftX, mouthCenterY);
        ctx.quadraticCurveTo(centerX, cpY, mRightX, mouthCenterY);
        ctx.stroke();

        // Open mouth fill below the curve
        if (p.mouthOpen > 0.01) {
            const openH = p.mouthOpen * canvasHeight * 0.08;
            ctx.globalAlpha = p.mouthOpen * 0.85;
            ctx.beginPath();
            ctx.moveTo(mLeftX, mouthCenterY);
            ctx.quadraticCurveTo(centerX, cpY, mRightX, mouthCenterY);
            ctx.quadraticCurveTo(centerX, cpY + openH, mLeftX, mouthCenterY);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

export function paintFrame(input: {
    blinkTime: number;
    borderColor: string;
    canvasHeight: number;
    canvasWidth: number;
    context: CanvasRenderingContext2D;
    faceParams: FaceParams;
    isActive: boolean;
    particles: Particle[];
    renderProfile: AvatarRenderProfile;
    rippleProgress: number;
    time: number;
}) {
    input.context.clearRect(0, 0, input.canvasWidth, input.canvasHeight);

    const centerX = input.canvasWidth / 2;
    const centerY = input.canvasHeight / 2;

    input.context.save();
    squirclePath(
        input.context,
        centerX,
        centerY,
        input.canvasWidth / 2 - 1,
        input.canvasHeight / 2 - 1
    );
    input.context.clip();

    const baseParticle = input.particles[0];
    if (baseParticle) {
        input.context.fillStyle = `rgb(${baseParticle.r | 0},${baseParticle.g | 0},${baseParticle.b | 0})`;
        input.context.fillRect(0, 0, input.canvasWidth, input.canvasHeight);
    }

    const cornerRadius = Math.max(
        0,
        (input.particles[0]?.baseSize ?? 4) * input.renderProfile.pixelCornerRadiusScale
    );

    for (const particle of input.particles) {
        particle.x = particle.homeX;
        particle.y = particle.homeY;

        let particleRed = particle.r;
        let particleGreen = particle.g;
        let particleBlue = particle.b;
        particle.size = particle.baseSize;

        if (input.isActive) {
            const wave1 = Math.sin(input.time * particle.speed * 2.5 + particle.phaseX);
            const wave2 = Math.sin(input.time * particle.speed * 1.3 + particle.phaseY * 1.3);
            const wave3 = Math.sin(
                input.time * particle.speed * 3.8 + particle.phaseX * 0.7 + particle.phaseY
            );
            const sparkle = (wave1 + wave2 + wave3) / 3;

            const waveAngle = input.time * 0.7;
            const wavePosition =
                Math.sin(waveAngle) * particle.nd +
                Math.cos(waveAngle * 0.7) * (particle.homeX / (input.canvasWidth || 1));
            const travelWave = Math.sin(input.time * 1.6 + wavePosition * 6) * 0.5 + 0.5;

            let boost = travelWave * input.renderProfile.travelWaveBoost;

            if (sparkle > input.renderProfile.sparkleThreshold) {
                const intensity =
                    (sparkle - input.renderProfile.sparkleThreshold) /
                    (1 - input.renderProfile.sparkleThreshold);
                const easedIntensity = intensity * intensity;
                boost += easedIntensity * input.renderProfile.sparkleBoost;

                if (sparkle > input.renderProfile.sparkleThreshold + 0.24) {
                    const hotness =
                        (sparkle - (input.renderProfile.sparkleThreshold + 0.24)) /
                        (1 - (input.renderProfile.sparkleThreshold + 0.24));
                    const variation =
                        0.28 + particle.nd * 0.18 + Math.sin(particle.phaseX * 3.7) * 0.08;
                    const mixAmount =
                        clamp(hotness, 0, 1) *
                        clamp(variation, 0.12, 0.5) *
                        input.renderProfile.hotMixStrength;

                    particleRed = mixChannel(
                        particleRed,
                        input.renderProfile.highlight[0],
                        mixAmount
                    );
                    particleGreen = mixChannel(
                        particleGreen,
                        input.renderProfile.highlight[1],
                        mixAmount
                    );
                    particleBlue = mixChannel(
                        particleBlue,
                        input.renderProfile.highlight[2],
                        mixAmount
                    );
                }
            }

            particleRed = Math.min(input.renderProfile.channelCap, particleRed + boost);
            particleGreen = Math.min(input.renderProfile.channelCap, particleGreen + boost);
            particleBlue = Math.min(input.renderProfile.channelCap, particleBlue + boost);
        }

        if (input.rippleProgress >= 0) {
            const distanceFromRing = Math.abs(particle.nd - input.rippleProgress);
            const bandWidth = 0.25;
            if (distanceFromRing < bandWidth) {
                const intensity = 1 - distanceFromRing / bandWidth;
                const easedIntensity = intensity * intensity * (3 - 2 * intensity);
                const boost = easedIntensity * 60;
                particleRed = Math.min(input.renderProfile.channelCap, particleRed + boost);
                particleGreen = Math.min(input.renderProfile.channelCap, particleGreen + boost);
                particleBlue = Math.min(input.renderProfile.channelCap, particleBlue + boost);
                particle.size = Math.round(particle.baseSize * (1 + easedIntensity * 0.2));
            }
        }

        input.context.fillStyle = `rgb(${particleRed | 0},${particleGreen | 0},${particleBlue | 0})`;

        const sizeOffset = (particle.size - particle.baseSize) / 2;
        const rectangleX = particle.x - sizeOffset;
        const rectangleY = particle.y - sizeOffset;
        const radius = Math.min(cornerRadius, particle.size / 2);

        input.context.beginPath();
        input.context.roundRect(rectangleX, rectangleY, particle.size, particle.size, radius);
        input.context.fill();
    }

    /* ── Face ── */
    drawFace(
        input.context,
        centerX,
        centerY,
        input.canvasWidth,
        input.canvasHeight,
        input.faceParams,
        input.blinkTime,
        input.time
    );

    input.context.restore();

    input.context.save();
    input.context.lineWidth = 1;
    input.context.strokeStyle = input.borderColor;
    squirclePath(
        input.context,
        centerX,
        centerY,
        input.canvasWidth / 2 - 1.5,
        input.canvasHeight / 2 - 1.5
    );
    input.context.stroke();
    input.context.restore();

    if (input.isActive) {
        return true;
    }

    if (input.faceParams.sleepiness > 0.01) {
        return true;
    }

    if (input.blinkTime >= 0 && input.blinkTime < 0.8) {
        return true;
    }

    return input.rippleProgress >= 0 && input.rippleProgress <= 1.5;
}
