import { type SVGProps, useEffect, useRef } from 'react';
import {
    type AgentEyeEmotion,
    blinkTiming,
    defaultEyeParams,
    dropPath,
    emotionConfig,
    eyesViewBox,
    leftEyeX,
    rightEyeX,
    sides,
} from './agent-eyes-config.ts';
import { easeInQuad, easeOutBack, resolveAnimatedEye, updateDrop } from './agent-eyes-motion.ts';
import { buildEyePath, resolveStaticEye } from './agent-eyes-path.ts';

export type { AgentEyeEmotion } from './agent-eyes-config.ts';
export { agentEyeEmotions } from './agent-eyes-config.ts';

export interface AgentEyesProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
    animated?: boolean;
    blinking?: boolean;
    color?: string;
    emotion?: AgentEyeEmotion;
    intensity?: number;
    size?: number;
    speed?: number;
}

export function AgentEyes({
    animated = true,
    blinking = true,
    color = 'currentColor',
    emotion = 'default',
    intensity = 1,
    size = 320,
    speed = 1,
    ...props
}: AgentEyesProps) {
    const leftRef = useRef<SVGPathElement | null>(null);
    const rightRef = useRef<SVGPathElement | null>(null);
    const dropRef = useRef<SVGPathElement | null>(null);
    const propRef = useRef({ blinking, emotion, intensity, speed });
    propRef.current = { blinking, emotion, intensity, speed };
    const initialPathsRef = useRef<{ left: string; right: string } | null>(null);

    // The animated loop drives emotion at runtime, so the rendered initial paths
    // stay the neutral default; the static (animated={false}) avatar shows these
    // resting eyes directly.
    initialPathsRef.current ??= {
        left: buildEyePath(resolveStaticEye(emotionConfig.default.L, 1), leftEyeX),
        right: buildEyePath(resolveStaticEye(emotionConfig.default.R, 1), rightEyeX),
    };

    useEffect(() => {
        if (!animated) {
            return;
        }

        const current = { L: defaultEyeParams.slice(), R: defaultEyeParams.slice() };
        const velocity = { L: new Array(14).fill(0), R: new Array(14).fill(0) };
        const target = new Array<number>(14);
        let lastEmotion: AgentEyeEmotion | null = null;
        let boing = 0;
        let boingVelocity = 0;
        let blink = 0;
        let blinkStartedAt = -1;
        let doubleQueued = false;
        let nextBlinkAt = performance.now() + 900 + Math.random() * 1200;
        let drop = { value: 0, velocity: 0 };
        let frameId = 0;
        let lastFrameAt = performance.now();

        const loop = (now: number) => {
            frameId = requestAnimationFrame(loop);

            const props = propRef.current;
            const dt = Math.min(0.033, (now - lastFrameAt) / 1000) || 0.016;
            const time = now / 1000;
            const emotionState = emotionConfig[props.emotion] ?? emotionConfig.default;
            const emotionChanged = props.emotion !== lastEmotion;

            lastFrameAt = now;

            if (emotionChanged) {
                lastEmotion = props.emotion;
                boingVelocity -= 1.5 * Math.max(0.2, props.speed);
            }

            boingVelocity = updateBoing(boing, boingVelocity, props.speed, dt);
            boing += boingVelocity * dt;

            for (const side of sides) {
                advanceParams({
                    current: current[side],
                    emotionChanged,
                    intensity: props.intensity,
                    speed: props.speed,
                    target,
                    targetParams: emotionState[side],
                    velocity: velocity[side],
                    dt,
                });
            }

            blink = updateBlink({
                blink,
                blinking: props.blinking,
                doubleQueued,
                emotion: emotionState.blink,
                nextBlinkAt,
                now,
                startedAt: blinkStartedAt,
                setBlinkSchedule: (next) => {
                    blinkStartedAt = next.startedAt;
                    doubleQueued = next.doubleQueued;
                    nextBlinkAt = next.nextBlinkAt;
                },
                dt,
            });

            leftRef.current?.setAttribute(
                'd',
                buildEyePath(
                    resolveAnimatedEye({
                        blink,
                        boing,
                        current: current.L,
                        emotion: emotionState,
                        side: 'L',
                        time,
                    }),
                    leftEyeX
                )
            );
            rightRef.current?.setAttribute(
                'd',
                buildEyePath(
                    resolveAnimatedEye({
                        blink,
                        boing,
                        current: current.R,
                        emotion: emotionState,
                        side: 'R',
                        time,
                    }),
                    rightEyeX
                )
            );
            drop = updateDrop(dropRef.current, emotionState, time, dt, drop.value, drop.velocity);
        };

        frameId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(frameId);
    }, [animated]);

    return (
        <svg
            aria-label={`Agent eyes, ${emotion}`}
            height={size}
            role="img"
            viewBox={`0 0 ${eyesViewBox} ${eyesViewBox}`}
            width={size}
            {...props}
        >
            <path d={initialPathsRef.current.left} fill={color} ref={leftRef} />
            <path d={initialPathsRef.current.right} fill={color} ref={rightRef} />
            <path d={dropPath} fill="#5fb8f6" opacity="0" ref={dropRef} />
        </svg>
    );
}

function advanceParams(input: {
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

function updateBoing(current: number, velocity: number, speed: number, dt: number) {
    const safeSpeed = Math.max(0.2, speed);
    const k = 130 * safeSpeed * safeSpeed;
    const c = 2 * 0.3 * Math.sqrt(k);

    return velocity + (-k * current - c * velocity) * dt;
}

function updateBlink(input: {
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
