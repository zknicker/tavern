import * as React from 'react';
import {
    type FaceVelocity,
    generateParticles,
    getEmoteTarget,
    paintFrame,
    springFaceParams,
    zeroVelocity,
} from './avatar-renderer.ts';
import {
    type AvatarRenderProfile,
    type AvatarTheme,
    buildAvatarBorderColor,
    resolveAvatarTheme,
} from './render-profile.ts';
import { cn } from './utils.ts';

export type AvatarEmote = 'idle' | 'happy' | 'focused' | 'surprised' | 'sleepy';

export interface AgentAvatarProps {
    /** Whether the agent is currently active/running */
    active?: boolean;
    /** Single character or emoji to display */
    avatar: string;
    /** Hex color for the dither pattern (e.g. "#e57373") */
    backgroundColor: string;
    /** Additional CSS classes — use to override size (default size-12) */
    className?: string;
    /** Emotion expression for the avatar eyes */
    emote?: AvatarEmote;
    /** Agent name — used as deterministic seed for unique shape generation */
    name?: string;
}

function hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

/** Mulberry32 PRNG — deterministic from seed */
function mulberry32(seed: number) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d_2b_79_f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

/* ────────────────────────── Sleepy Z's CSS ────────────────────── */

const SLEEPY_Z_STYLE_ID = 'agent-avatar-sleepy-z';

function ensureSleepyZStyles() {
    if (typeof document === 'undefined') {
        return;
    }
    if (document.getElementById(SLEEPY_Z_STYLE_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = SLEEPY_Z_STYLE_ID;
    style.textContent = `
@keyframes sleepy-z-float {
    0% {
        opacity: 0;
        transform: translate(0%, 0%) scale(0.5) rotate(0deg);
    }
    2% {
        opacity: 0.85;
        transform: translate(5%, -5%) scale(0.55) rotate(0deg);
    }
    11% {
        opacity: 0.7;
        transform: translate(55%, -55%) scale(0.75) rotate(-12deg);
    }
    20% {
        opacity: 0.3;
        transform: translate(30%, -120%) scale(0.95) rotate(8deg);
    }
    27% {
        opacity: 0;
        transform: translate(70%, -160%) scale(1.0) rotate(-5deg);
    }
    100% {
        opacity: 0;
        transform: translate(70%, -160%) scale(1.0) rotate(-5deg);
    }
}
.sleepy-z {
    animation: sleepy-z-float 7s linear infinite;
}
`;
    document.head.appendChild(style);
}

/* ────────────────────────── Component ────────────────────── */

function useAvatarTheme(): AvatarTheme {
    const [theme, setTheme] = React.useState<AvatarTheme>(() =>
        typeof document === 'undefined'
            ? 'dark'
            : resolveAvatarTheme(document.documentElement.dataset.theme)
    );

    React.useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        const documentElement = document.documentElement;
        const observer = new MutationObserver(() => {
            setTheme(resolveAvatarTheme(documentElement.dataset.theme));
        });

        observer.observe(documentElement, {
            attributeFilter: ['data-theme'],
            attributes: true,
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    return theme;
}

export const AgentAvatar = React.memo(function AgentAvatar({
    active = false,
    avatar,
    backgroundColor,
    className,
    emote = 'idle',
    name,
}: AgentAvatarProps) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const theme = useAvatarTheme();
    const borderColor = buildAvatarBorderColor(backgroundColor);

    const stateRef = React.useRef({
        blinkStart: -1,
        faceParams: getEmoteTarget(emote),
        faceVelocity: zeroVelocity() as FaceVelocity,
        frameId: 0,
        lastFrame: 0,
        particles: [] as ReturnType<typeof generateParticles>['particles'],
        renderProfile: null as AvatarRenderProfile | null,
        time: 0,
        hoverStart: -1,
        canvasW: 0,
        canvasH: 0,
    });

    const activeRef = React.useRef(active);
    activeRef.current = active;

    const emoteRef = React.useRef(emote);
    emoteRef.current = emote;

    const seedName = name || avatar;

    /* ── Animation loop ── */
    const tick = React.useCallback(
        (now: number) => {
            const s = stateRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');

            if (!(ctx && canvas)) {
                s.frameId = 0;
                return;
            }

            const dt = s.lastFrame ? (now - s.lastFrame) / 1000 : 0.016;
            s.lastFrame = now;
            s.time += dt;

            let rippleProgress = -1;
            if (s.hoverStart > 0) {
                rippleProgress = (now - s.hoverStart) / 700;
                if (rippleProgress > 1.5) {
                    s.hoverStart = -1;
                    rippleProgress = -1;
                }
            }

            let blinkTime = -1;
            if (s.blinkStart > 0) {
                blinkTime = (now - s.blinkStart) / 1000;
                if (blinkTime > 0.8) {
                    s.blinkStart = -1;
                    blinkTime = -1;
                }
            }

            /* Spring face params toward current emote target */
            const emoteTarget = getEmoteTarget(emoteRef.current);
            const faceMoving = springFaceParams(s.faceParams, s.faceVelocity, emoteTarget, dt);

            if (!s.renderProfile) {
                s.frameId = 0;
                return;
            }

            const stillAnimating =
                paintFrame({
                    blinkTime,
                    borderColor,
                    canvasHeight: s.canvasH,
                    canvasWidth: s.canvasW,
                    context: ctx,
                    faceParams: s.faceParams,
                    isActive: activeRef.current,
                    particles: s.particles,
                    renderProfile: s.renderProfile,
                    rippleProgress,
                    time: s.time,
                }) || faceMoving;

            if (stillAnimating) {
                s.frameId = requestAnimationFrame(tick);
            } else {
                s.frameId = 0;
            }
        },
        [borderColor]
    );

    const ensureLoop = React.useCallback(() => {
        const s = stateRef.current;
        if (!s.frameId && s.particles.length > 0) {
            s.lastFrame = 0;
            s.frameId = requestAnimationFrame(tick);
        }
    }, [tick]);

    /* ── Size observer + initial paint ── */
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio, 2);
            /* Canvas is larger than the element (extends via negative inset) */
            const cw = Math.round(rect.width * dpr);
            const ch = Math.round(rect.height * dpr);
            if (cw === 0 || ch === 0) {
                return;
            }

            canvas.width = cw;
            canvas.height = ch;

            const s = stateRef.current;
            s.canvasW = cw;
            s.canvasH = ch;
            const seed = hashString(seedName);
            const rng = mulberry32(seed);
            const generated = generateParticles({
                color: backgroundColor,
                height: ch,
                rng,
                theme,
                width: cw,
            });
            s.particles = generated.particles;
            s.renderProfile = generated.renderProfile;

            const ctx = canvas.getContext('2d');
            if (ctx && s.renderProfile) {
                paintFrame({
                    blinkTime: -1,
                    borderColor,
                    canvasHeight: ch,
                    canvasWidth: cw,
                    context: ctx,
                    faceParams: s.faceParams,
                    isActive: false,
                    particles: s.particles,
                    renderProfile: s.renderProfile,
                    rippleProgress: -1,
                    time: 0,
                });
            }

            if (activeRef.current) {
                ensureLoop();
            }
        });

        observer.observe(canvas);
        return () => {
            observer.disconnect();
            const s = stateRef.current;
            if (s.frameId) {
                cancelAnimationFrame(s.frameId);
                s.frameId = 0;
            }
        };
    }, [backgroundColor, seedName, ensureLoop, theme, borderColor]);

    /* ── React to `active` / `emote` changes ── */
    React.useEffect(() => {
        ensureLoop();
    }, [ensureLoop]);

    /* ── Periodic blink ── */
    React.useEffect(() => {
        const s = stateRef.current;
        let timerId: ReturnType<typeof setTimeout>;

        const scheduleBlink = () => {
            const delay = 2500 + Math.random() * 4000;
            timerId = setTimeout(() => {
                if (emoteRef.current !== 'sleepy') {
                    s.blinkStart = performance.now();
                    ensureLoop();
                }
                scheduleBlink();
            }, delay);
        };

        // Stagger initial blink so avatars don't all blink together
        const initialDelay = 1000 + Math.random() * 3000;
        timerId = setTimeout(() => {
            if (emoteRef.current !== 'sleepy') {
                s.blinkStart = performance.now();
                ensureLoop();
            }
            scheduleBlink();
        }, initialDelay);

        return () => {
            clearTimeout(timerId);
        };
    }, [ensureLoop]);

    /* ── Hover handlers ── */
    const onMouseEnter = React.useCallback(() => {
        const s = stateRef.current;
        s.hoverStart = performance.now();
        ensureLoop();
    }, [ensureLoop]);

    const onMouseLeave = React.useCallback(() => {
        stateRef.current.hoverStart = -1;
    }, []);

    const isSleepy = emote === 'sleepy';
    if (isSleepy) {
        ensureSleepyZStyles();
    }

    // Deterministic random offset so each avatar's Z's are out of sync
    const zOffset = React.useMemo(() => {
        const h = hashString(`${seedName}-z`);
        return (h % 7000) / 1000; // 0–7s offset
    }, [seedName]);

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Hover handlers only drive decorative avatar motion.
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Hover handlers only drive decorative avatar motion.
        <span
            className={cn(
                'group/avatar relative inline-flex size-12 shrink-0 items-center justify-center overflow-visible font-semibold text-sm text-white transition-transform duration-200 hover:scale-105',
                className
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{ containerType: 'inline-size' }}
        >
            <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />
            {isSleepy && (
                <>
                    <span
                        className="sleepy-z pointer-events-none absolute font-black"
                        style={{
                            top: '-5%',
                            right: '10%',
                            fontSize: '90cqi',
                            lineHeight: 1,
                            color: borderColor,
                            animationDelay: `${-zOffset}s`,
                        }}
                    >
                        z
                    </span>
                    <span
                        className="sleepy-z pointer-events-none absolute font-black"
                        style={{
                            top: '-5%',
                            right: '10%',
                            fontSize: '76cqi',
                            lineHeight: 1,
                            color: borderColor,
                            animationDelay: `${-zOffset - 0.6}s`,
                        }}
                    >
                        z
                    </span>
                    <span
                        className="sleepy-z pointer-events-none absolute font-black"
                        style={{
                            top: '-5%',
                            right: '10%',
                            fontSize: '60cqi',
                            lineHeight: 1,
                            color: borderColor,
                            animationDelay: `${-zOffset - 1.2}s`,
                        }}
                    >
                        z
                    </span>
                </>
            )}
        </span>
    );
});
