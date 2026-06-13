import type { EmotionConfig, EyeParams, EyeSide } from './agent-eyes-config.ts';

export function resolveAnimatedEye(input: {
    blink: number;
    boing: number;
    current: EyeParams;
    emotion: EmotionConfig;
    side: EyeSide;
    time: number;
}) {
    const params = input.current.slice();

    applyBoing(params, input.boing);
    applyBreath(params, input.emotion, input.time);
    applyLaugh(params, input.emotion, input.time);
    applySway(params, input.emotion, input.side, input.time);
    applyPonder(params, input.emotion, input.time);
    applyTremor(params, input.emotion, input.side, input.time);
    applyBlink(params, input.blink);

    return params;
}

export function updateDrop(
    node: SVGPathElement | null,
    emotion: EmotionConfig,
    time: number,
    dt: number,
    current: number,
    velocity: number
) {
    const target = emotion.drop ? 1 : 0;
    const nextVelocity = velocity + (90 * (target - current) - 17 * velocity) * dt;
    const nextValue = current + nextVelocity * dt;

    if (!node) {
        return { value: nextValue, velocity: nextVelocity };
    }

    if (nextValue <= 0.01) {
        node.setAttribute('opacity', '0');
        return { value: nextValue, velocity: nextVelocity };
    }

    const cycle = (time % 1.9) / 1.9;
    const frame = getDropFrame(cycle);

    node.setAttribute(
        'transform',
        `translate(444 ${frame.y.toFixed(1)}) scale(${(frame.scale * nextValue * 2.8).toFixed(3)})`
    );
    node.setAttribute('opacity', (frame.opacity * nextValue * 0.95).toFixed(3));

    return { value: nextValue, velocity: nextVelocity };
}

export const easeInQuad = (progress: number) => progress * progress;

export function easeOutBack(progress: number) {
    const c = 1.2;
    return 1 + (c + 1) * (progress - 1) ** 3 + c * (progress - 1) ** 2;
}

function applyBoing(params: EyeParams, boing: number) {
    if (boing === 0) {
        return;
    }

    const scale = 1 + Math.max(-0.35, Math.min(0.35, boing));

    for (const index of [2, 3, 4, 5, 6, 7]) {
        params[index] *= scale;
    }
    params[1] -= boing * 10;
}

function applyBreath(params: EyeParams, emotion: EmotionConfig, time: number) {
    params[1] += Math.sin(time * Math.PI * 2 * 0.22) * 2.2 * emotion.breath;
    params[3] += Math.sin(time * Math.PI * 2 * 0.22 + 0.6) * 1.8 * emotion.breath;
}

function applyLaugh(params: EyeParams, emotion: EmotionConfig, time: number) {
    if (!emotion.bounce) {
        return;
    }

    const period = (time % 2.3) / 2.3;
    const envelope = period < 0.62 ? Math.sqrt(Math.sin((Math.PI * period) / 0.62)) : 0;
    const laughBeat = Math.max(0, Math.sin(time * Math.PI * 2 * 3.3)) ** 2.2;
    const amount = envelope * laughBeat;

    params[1] -= amount * 15;
    params[3] -= amount * 9;
    params[2] += amount * 7;
    params[11] -= amount * 12;
    params[12] += Math.sin(time * Math.PI * 2 * 1.65) * envelope * 2.2;
}

function applySway(params: EyeParams, emotion: EmotionConfig, side: EyeSide, time: number) {
    if (!emotion.sway) {
        return;
    }

    params[0] += Math.sin(time * Math.PI * 2 * 0.5) * (side === 'R' ? 5 : 1.6);
    if (side === 'R') {
        params[12] += Math.sin(time * Math.PI * 2 * 0.5) * 2;
    }
}

function applyPonder(params: EyeParams, emotion: EmotionConfig, time: number) {
    if (!emotion.ponder) {
        return;
    }

    const stations = [
        [42, -18],
        [-36, -26],
        [18, 12],
        [-44, -4],
        [38, -30],
        [-10, 16],
    ];
    const interval = 1.6;
    const index = Math.floor(time / interval);
    const a = stations[index % stations.length];
    const b = stations[(index + 1) % stations.length];
    let ease = Math.min(1, (time / interval - index) * 5);
    ease = ease * ease * (3 - 2 * ease);

    const gx = a[0] + (b[0] - a[0]) * ease;
    const gy = a[1] + (b[1] - a[1]) * ease;
    const scale = Math.max(0.8, 1 - Math.hypot(gx, gy) * 0.0035);

    params[0] += gx;
    params[1] += gy;
    params[12] += gx * 0.07;
    for (const i of [2, 3, 4, 5, 6, 7]) {
        params[i] *= scale;
    }
    params[3] += Math.sin(time * Math.PI * 2 * 1.1) * 5;
}

function applyTremor(params: EyeParams, emotion: EmotionConfig, side: EyeSide, time: number) {
    if (emotion.tremor) {
        params[0] += Math.sin(time * Math.PI * 2 * 9) * (side === 'R' ? 1.1 : -1.1);
    }
}

function applyBlink(params: EyeParams, blink: number) {
    if (blink === 0) {
        return;
    }

    const visibleBlink = Math.max(0, blink);
    params[1] += visibleBlink * params[3] * 0.2;
    params[3] += (Math.min(params[3], 34) - params[3]) * blink;
    params[8] *= 1 - visibleBlink;
    params[9] *= 1 - visibleBlink;
    params[10] *= 1 - visibleBlink;
    params[11] *= 1 - visibleBlink;
}

function getDropFrame(cycle: number) {
    if (cycle < 0.18) {
        const q = cycle / 0.18;
        return { opacity: q, scale: 0.35 + 0.65 * q, y: 92 };
    }

    if (cycle < 0.62) {
        const q = (cycle - 0.18) / 0.44;
        return { opacity: 1, scale: 1, y: 92 + 118 * q * q };
    }

    if (cycle < 0.78) {
        const q = (cycle - 0.62) / 0.16;
        return { opacity: 1 - q, scale: 1, y: 210 + 14 * q };
    }

    return { opacity: 0, scale: 1, y: 92 };
}
