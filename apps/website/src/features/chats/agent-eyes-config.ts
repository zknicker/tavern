export const eyesViewBox = 480;
export const leftEyeX = 119;
export const rightEyeX = 361;
export const eyeCenterY = 240;
export const sides = ['L', 'R'] as const;
export const dropPath = 'M0 -16 C7 -6 11 1 11 7 A11 11 0 1 1 -11 7 C-11 1 -7 -6 0 -16 Z';

export type EyeSide = (typeof sides)[number];
export type EyeParams = number[];
export type BlinkMode = 'fast' | 'none' | 'norm' | 'rare' | 'sleepy';

export interface EmotionConfig {
    blink: BlinkMode;
    bounce?: number;
    breath: number;
    drop?: number;
    L: EyeParams;
    ponder?: number;
    R: EyeParams;
    sway?: number;
    tremor?: number;
}

export const defaultEyeParams: EyeParams = [0, 0, 170, 290, 65, 65, 65, 65, 0, 0, 0, 0, 0, 0];

export const emotionConfig = {
    angry: {
        L: [0, 14, 172, 200, 62, 30, 58, 58, 46, 0, 0, 0, 4, 0],
        R: [0, 14, 172, 200, 30, 62, 58, 58, -46, 0, 0, 0, -4, 0],
        blink: 'rare',
        breath: 0.8,
    },
    blink: { L: defaultEyeParams, R: defaultEyeParams, blink: 'fast', breath: 1 },
    closed: {
        L: [0, 28, 176, 38, 18, 18, 18, 18, 0, 0, 0, 0, 0, 0],
        R: [0, 28, 176, 38, 18, 18, 18, 18, 0, 0, 0, 0, 0, 0],
        blink: 'none',
        breath: 1.4,
    },
    confused: {
        L: [0, -8, 184, 304, 68, 68, 68, 68, 0, 0, 0, 0, -5, 0],
        R: [0, -30, 160, 124, 48, 48, 48, 48, 0, 0, 0, 0, 12, 0],
        blink: 'norm',
        breath: 1,
        sway: 1,
    },
    curious: {
        L: [0, -32, 192, 318, 76, 76, 76, 76, 0, 0, 0, 0, 11, 0],
        R: [0, 28, 156, 258, 58, 58, 58, 58, 0, 0, 0, 0, 11, 0],
        blink: 'norm',
        breath: 1.2,
    },
    default: { L: defaultEyeParams, R: defaultEyeParams, blink: 'norm', breath: 1 },
    happy: {
        L: [0, -48, 176, 142, 70, 70, 22, 22, 0, 0, 0, -58, -9, 0],
        R: [0, -48, 176, 142, 70, 70, 22, 22, 0, 0, 0, -58, 9, 0],
        blink: 'none',
        breath: 1.3,
    },
    idle: { L: defaultEyeParams, R: defaultEyeParams, blink: 'norm', breath: 2.4 },
    laughing: {
        L: [0, -40, 180, 130, 66, 66, 20, 20, 0, 0, 0, -62, -7, 0],
        R: [0, -40, 180, 130, 66, 66, 20, 20, 0, 0, 0, -62, 7, 0],
        blink: 'none',
        breath: 1,
        bounce: 1,
    },
    sweat: {
        L: [0, 14, 168, 248, 56, 56, 58, 58, -22, 0, 0, 0, -2, 0],
        R: [0, 14, 168, 248, 56, 56, 58, 58, 22, 0, 0, 0, 2, 0],
        blink: 'norm',
        breath: 1,
        drop: 1,
        tremor: 1,
    },
    thinking: {
        L: [0, -26, 164, 228, 62, 62, 62, 62, 10, 0, 0, 0, 2, 0],
        R: [0, -26, 164, 228, 62, 62, 62, 62, -10, 0, 0, 0, 2, 0],
        blink: 'norm',
        breath: 1.1,
        ponder: 1,
    },
    tired: {
        L: [0, 46, 174, 158, 56, 56, 58, 58, -38, 0, 0, 0, -3, 0],
        R: [0, 46, 174, 158, 56, 56, 58, 58, 38, 0, 0, 0, 3, 0],
        blink: 'sleepy',
        breath: 1.7,
    },
} satisfies Record<string, EmotionConfig>;

export type AgentEyeEmotion = keyof typeof emotionConfig;
export const agentEyeEmotions = Object.keys(emotionConfig) as AgentEyeEmotion[];

export const blinkTiming = {
    fast: { close: 75, hold: 70, min: 0.8, open: 200, rand: 0.2 },
    none: null,
    norm: { close: 80, hold: 50, min: 2.2, open: 210, rand: 2.6 },
    rare: { close: 80, hold: 50, min: 4.5, open: 210, rand: 3.5 },
    sleepy: { close: 220, hold: 170, min: 1.7, open: 420, rand: 1.5 },
} satisfies Record<
    BlinkMode,
    { close: number; hold: number; min: number; open: number; rand: number } | null
>;
