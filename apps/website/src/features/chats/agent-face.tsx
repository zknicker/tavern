import { type SVGProps, useEffect, useRef } from 'react';
import {
    type AgentEyeEmotion,
    defaultEyeParams,
    dropPath,
    emotionConfig,
    eyeCenterY,
    eyesViewBox,
    leftEyeX,
    rightEyeX,
    sides,
} from './agent-eyes-config.ts';
import { resolveAnimatedEye, updateDrop } from './agent-eyes-motion.ts';
import { buildEyePath, resolveStaticEye } from './agent-eyes-path.ts';
import { type HeadKind, resolveHead } from './agent-face-heads.tsx';
import { advanceParams, updateBlink, updateBoing } from './agent-face-loop.ts';

export type { AgentEyeEmotion } from './agent-eyes-config.ts';
export { agentEyeEmotions } from './agent-eyes-config.ts';
export type { HeadKind } from './agent-face-heads.tsx';

// The whole face pivots near its base so the squash reads as a grounded,
// jelly-like settle rather than a scale about the center.
const facePivotX = eyeCenterY;
const facePivotY = 320;

export interface AgentFaceProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
    animated?: boolean;
    blinking?: boolean;
    dark?: boolean;
    emotion?: AgentEyeEmotion;
    head?: HeadKind;
    intensity?: number;
    size?: number;
    speed?: number;
}

export function AgentFace({
    animated = true,
    blinking = true,
    dark = false,
    emotion = 'default',
    head = 'none',
    intensity = 1,
    size = 320,
    speed = 1,
    ...props
}: AgentFaceProps) {
    const faceRef = useRef<SVGGElement | null>(null);
    const leftRef = useRef<SVGPathElement | null>(null);
    const rightRef = useRef<SVGPathElement | null>(null);
    const dropRef = useRef<SVGPathElement | null>(null);
    const propRef = useRef({ blinking, emotion, intensity, speed });
    propRef.current = { blinking, emotion, intensity, speed };
    const initialPathsRef = useRef<{ left: string; right: string } | null>(null);

    // Resting eyes for the static avatar; the animated loop overrides these.
    initialPathsRef.current ??= {
        left: buildEyePath(resolveStaticEye(emotionConfig.default.L, 1), leftEyeX),
        right: buildEyePath(resolveStaticEye(emotionConfig.default.R, 1), rightEyeX),
    };

    useEffect(() => {
        if (!animated) {
            return;
        }

        return runFaceLoop({
            dropNode: () => dropRef.current,
            faceNode: () => faceRef.current,
            leftNode: () => leftRef.current,
            propRef,
            rightNode: () => rightRef.current,
        });
    }, [animated]);

    const layers = resolveHead(head, dark);
    const slot = layers.slot;
    const slotTransform = `translate(${slot.dx} ${slot.dy}) translate(${eyeCenterY} ${eyeCenterY}) scale(${slot.s}) translate(${-eyeCenterY} ${-eyeCenterY})`;

    return (
        <svg
            aria-label={`${head} agent, ${emotion}`}
            height={size}
            role="img"
            viewBox={`0 0 ${eyesViewBox} ${eyesViewBox}`}
            width={size}
            {...props}
        >
            <g ref={faceRef}>
                {layers.back}
                <g transform={slotTransform}>
                    <path d={initialPathsRef.current.left} fill={layers.eyeColor} ref={leftRef} />
                    <path d={initialPathsRef.current.right} fill={layers.eyeColor} ref={rightRef} />
                    <path d={dropPath} fill="#5fb8f6" opacity="0" ref={dropRef} />
                </g>
                {layers.front}
            </g>
        </svg>
    );
}

interface FaceLoopHandles {
    dropNode: () => SVGPathElement | null;
    faceNode: () => SVGGElement | null;
    leftNode: () => SVGPathElement | null;
    propRef: {
        current: { blinking: boolean; emotion: AgentEyeEmotion; intensity: number; speed: number };
    };
    rightNode: () => SVGPathElement | null;
}

function runFaceLoop(handles: FaceLoopHandles) {
    const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

        const props = handles.propRef.current;
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
                dt,
                emotionChanged,
                intensity: props.intensity,
                speed: props.speed,
                target,
                targetParams: emotionState[side],
                velocity: velocity[side],
            });
        }

        blink = updateBlink({
            blink,
            blinking: props.blinking,
            doubleQueued,
            dt,
            emotion: emotionState.blink,
            nextBlinkAt,
            now,
            setBlinkSchedule: (next) => {
                blinkStartedAt = next.startedAt;
                doubleQueued = next.doubleQueued;
                nextBlinkAt = next.nextBlinkAt;
            },
            startedAt: blinkStartedAt,
        });

        handles.leftNode()?.setAttribute(
            'd',
            buildEyePath(
                resolveAnimatedEye({
                    blink,
                    current: current.L,
                    emotion: emotionState,
                    side: 'L',
                    time,
                }),
                leftEyeX
            )
        );
        handles.rightNode()?.setAttribute(
            'd',
            buildEyePath(
                resolveAnimatedEye({
                    blink,
                    current: current.R,
                    emotion: emotionState,
                    side: 'R',
                    time,
                }),
                rightEyeX
            )
        );
        drop = updateDrop(handles.dropNode(), emotionState, time, dt, drop.value, drop.velocity);

        applyFaceTransform(handles.faceNode(), emotionState.breath, boing, time, Boolean(reduce));
    };

    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
}

// The face group carries the breath bob plus the boing squash so the head and
// eyes deform together as one living body.
function applyFaceTransform(
    node: SVGGElement | null,
    breath: number,
    boing: number,
    time: number,
    reduce: boolean
) {
    if (!node) {
        return;
    }

    const breathY = reduce ? 0 : Math.sin(time * Math.PI * 2 * 0.22) * 3 * breath;
    const bz = reduce ? 0 : Math.max(-0.3, Math.min(0.3, boing));
    const scale = 1 + bz;
    const translateY = breathY - bz * 12;

    node.setAttribute(
        'transform',
        `translate(0 ${translateY.toFixed(2)}) translate(${facePivotX} ${facePivotY}) scale(${scale.toFixed(4)}) translate(${-facePivotX} ${-facePivotY})`
    );
}
