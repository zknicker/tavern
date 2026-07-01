import { blinkTiming, defaultEyeParams } from './agent-eyes-config.ts';
import { easeInQuad, easeOutBack } from './agent-eyes-motion.ts';

// Per-frame integrators shared by the animated face. Eye params spring toward
// the active emotion, the whole-body "boing" settles after each change, and the
// blink schedule advances on its own cadence.

export function advanceParams(input: {
    current: number[];
    dt: number;
    emotionChanged: boolean;
    intensity: number;
    speed: number;
    target: number[];
    targetParams: number[];
    velocity: number[];
}) {
    const speed = Math.max(0.2, input.speed);
    const intensity = Math.max(0, Math.min(1.25, input.intensity));
    const k = 165 * speed * speed;
    const c = 2 * 0.72 * Math.sqrt(k);

    for (let index = 0; index < 14; index += 1) {
        input.target[index] =
            defaultEyeParams[index] +
            (input.targetParams[index] - defaultEyeParams[index]) * intensity;
        if (input.emotionChanged) {
            input.velocity[index] -= (input.target[index] - input.current[index]) * 3.2;
        }
        input.velocity[index] +=
            (k * (input.target[index] - input.current[index]) - c * input.velocity[index]) *
            input.dt;
        input.current[index] += input.velocity[index] * input.dt;
    }
}

export function updateBoing(current: number, velocity: number, speed: number, dt: number) {
    const safeSpeed = Math.max(0.2, speed);
    const k = 130 * safeSpeed * safeSpeed;
    const c = 2 * 0.3 * Math.sqrt(k);

    return velocity + (-k * current - c * velocity) * dt;
}

export function updateBlink(input: {
    blink: number;
    blinking: boolean;
    doubleQueued: boolean;
    dt: number;
    emotion: keyof typeof blinkTiming;
    nextBlinkAt: number;
    now: number;
    setBlinkSchedule: (next: {
        doubleQueued: boolean;
        nextBlinkAt: number;
        startedAt: number;
    }) => void;
    startedAt: number;
}) {
    const timing = blinkTiming[input.emotion];

    if (!(input.blinking && timing)) {
        if (input.blink === 0) {
            return 0;
        }
        input.setBlinkSchedule({
            doubleQueued: input.doubleQueued,
            nextBlinkAt: input.nextBlinkAt,
            startedAt: -1,
        });
        return Math.max(0, input.blink - input.dt * 7);
    }

    const startedAt =
        input.startedAt < 0 && input.now >= input.nextBlinkAt ? input.now : input.startedAt;

    if (startedAt < 0) {
        return input.blink;
    }

    const elapsed = input.now - startedAt;

    if (elapsed < timing.close) {
        input.setBlinkSchedule({
            doubleQueued: input.doubleQueued,
            nextBlinkAt: input.nextBlinkAt,
            startedAt,
        });
        return easeInQuad(elapsed / timing.close);
    }

    if (elapsed < timing.close + timing.hold) {
        return 1;
    }

    if (elapsed < timing.close + timing.hold + timing.open) {
        return 1 - easeOutBack((elapsed - timing.close - timing.hold) / timing.open);
    }

    if (!input.doubleQueued && Math.random() < 0.22) {
        input.setBlinkSchedule({
            doubleQueued: true,
            nextBlinkAt: input.now + 240,
            startedAt: -1,
        });
    } else {
        input.setBlinkSchedule({
            doubleQueued: false,
            nextBlinkAt: input.now + (timing.min + Math.random() * timing.rand) * 1000,
            startedAt: -1,
        });
    }

    return 0;
}
