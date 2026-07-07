import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/* ============================================================
   AgentFace — head-silhouette layer for AgentEyes
   - Eyes drop into a per-head "face slot" (translate + scale)
   - Whole character breathes + boings as ONE unit (cohesion)
   - Light / dark fill, with eye-color inversion (white animals
     get dark eyes; solid-black silhouettes + the robot screen
     get light eyes) — the hilos.sh doodle vocabulary
   - Heads are a tiny registry of primitives → a crowd from few parts
   Usage: <AgentFace head="owl" emotion="curious" size={320} />
   ============================================================ */

/* ───────────────────────────────────────────────────────────
   EYES — verbatim from your AgentEyes component, untouched.
   (The only behavioral change lives OUTSIDE this block: the
   squash/stretch "boing" is now owned by the face group so the
   head and eyes squash together. Eye geometry is identical.)
   ─────────────────────────────────────────────────────────── */

export interface Slot {
    dx: number;
    dy: number;
    s: number;
}
type BlinkMode = 'norm' | 'sleepy' | 'rare' | 'fast' | 'none';
interface EmoDef {
    blink: BlinkMode;
    bounce?: number;
    breath: number;
    drop?: number;
    L: number[];
    ponder?: number;
    R: number[];
    sway?: number;
    tremor?: number;
}
interface BlinkDef {
    close: number;
    hold: number;
    min: number;
    open: number;
    rand: number;
}
export interface WarpLayer {
    baseD: string;
    d: string;
    fill: string;
    fillRule?: 'nonzero' | 'evenodd';
    rings: number[][];
    stroke?: string;
    strokeWidth?: number;
}
export interface WarpSet {
    back: WarpLayer[];
    front: WarpLayer[];
}
export interface HeadSpec {
    back: ReactNode[];
    clip?: number;
    eyeColor: string;
    /** Per-head eye restyle: width/height scale on every resolved pose. Corner
        radii saturate in buildPathPts, so a squarer aspect reads rounder.
        Alien uses this — its round white sockets want wide round eyes, not the
        standard tall capsule. */
    eyeScale?: { w: number; h: number };
    front: ReactNode[];
    hlColor?: string;
    slot?: Slot;
    /** Center third eye (eye-canvas offsets from (240, CY)). Pose is the L/R
        average, so it blinks and follows gaze with the pair. */
    thirdEye?: { dx: number; dy: number };
    warp?: WarpSet;
}
interface HeadPoseDef {
    bounce?: number;
    drift?: number;
    dy: number;
    sq: number;
    sway?: number;
    tl: number;
    tremor?: number;
}

const VB = 480;
const LX = 119,
    RX = 361,
    CY = 240;
const N_EXP = 2.7,
    EPOW = 2 / N_EXP;

const D0 = [0, 0, 170, 290, 65, 65, 65, 65, 0, 0, 0, 0, 0, 0];

const RAW_EMO = {
    default: { L: D0, R: D0, blink: 'norm', breath: 1 },
    idle: { L: D0, R: D0, blink: 'norm', breath: 2.4 },
    happy: {
        L: [0, -48, 176, 142, 70, 70, 22, 22, 0, 0, 0, -58, -9, 0],
        R: [0, -48, 176, 142, 70, 70, 22, 22, 0, 0, 0, -58, 9, 0],
        blink: 'none',
        breath: 1.3,
    },
    laughing: {
        L: [0, -40, 180, 130, 66, 66, 20, 20, 0, 0, 0, -62, -7, 0],
        R: [0, -40, 180, 130, 66, 66, 20, 20, 0, 0, 0, -62, 7, 0],
        blink: 'none',
        breath: 1,
        bounce: 1,
    },
    tired: {
        L: [0, 46, 174, 158, 56, 56, 58, 58, -38, 0, 0, 0, -3, 0],
        R: [0, 46, 174, 158, 56, 56, 58, 58, 38, 0, 0, 0, 3, 0],
        blink: 'sleepy',
        breath: 1.7,
    },
    angry: {
        L: [0, 14, 172, 200, 62, 30, 58, 58, 46, 0, 0, 0, 4, 0],
        R: [0, 14, 172, 200, 30, 62, 58, 58, -46, 0, 0, 0, -4, 0],
        blink: 'rare',
        breath: 0.8,
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
    thinking: {
        L: [0, -26, 182, 276, 70, 70, 70, 70, 12, 0, 0, 0, 2, 0],
        R: [0, -26, 182, 276, 70, 70, 70, 70, -12, 0, 0, 0, 2, 0],
        blink: 'norm',
        breath: 1.1,
        ponder: 1,
    },
    sweat: {
        L: [0, 14, 168, 248, 56, 56, 58, 58, -22, 0, 0, 0, -2, 0],
        R: [0, 14, 168, 248, 56, 56, 58, 58, 22, 0, 0, 0, 2, 0],
        blink: 'norm',
        breath: 1,
        tremor: 1,
        drop: 1,
    },
    blink: { L: D0, R: D0, blink: 'fast', breath: 1 },
    closed: {
        L: [0, 28, 176, 38, 18, 18, 18, 18, 0, 0, 0, 0, 0, 0],
        R: [0, 28, 176, 38, 18, 18, 18, 18, 0, 0, 0, 0, 0, 0],
        blink: 'none',
        breath: 1.4,
    },
} satisfies Record<string, EmoDef>;
// Eye style v3 (owl-derived): eyes measure 63×108 rendered at EYE_FRAME s=0.7066,
// so raw eye-canvas dims = 89.2×153.5 → KW/KH below. KR still clamps rest to a
// full capsule; expressive small-radius poses (angry) keep their edge. Applied
// uniformly to every emotion pose so all animations keep their character.
const KW = 0.5244,
    KH = 0.5294,
    KR = 1.32;
const scaleP = (p: number[]): number[] => [
    p[0] * KW,
    p[1] * KH,
    p[2] * KW,
    p[3] * KH,
    p[4] * KW * KR,
    p[5] * KW * KR,
    p[6] * KW * KR,
    p[7] * KW * KR,
    p[8] * KH,
    p[9] * KH,
    p[10] * KH,
    p[11] * KH,
    p[12],
    p[13],
];
const D = scaleP(D0);
export type Emotion = keyof typeof RAW_EMO;
const EMO = Object.fromEntries(
    Object.entries(RAW_EMO).map(([k, v]) => [k, { ...v, L: scaleP(v.L), R: scaleP(v.R) }])
) as Record<Emotion, EmoDef>;
export const EMOTIONS = Object.keys(RAW_EMO) as Emotion[];

const BLINK: Record<BlinkMode, BlinkDef | null> = {
    norm: { min: 2.2, rand: 2.6, close: 80, hold: 50, open: 210 },
    sleepy: { min: 1.7, rand: 1.5, close: 220, hold: 170, open: 420 },
    rare: { min: 4.5, rand: 3.5, close: 80, hold: 50, open: 210 },
    fast: { min: 0.8, rand: 0.2, close: 75, hold: 70, open: 200 },
    none: null,
};

const CORNER: [number, number][] = [];
for (let i = 0; i <= 10; i++) {
    const t = (Math.PI / 2) * (i / 10);
    CORNER.push([Math.cos(t) ** EPOW, Math.sin(t) ** EPOW]);
}
const QT: number[] = [];
for (let i = 1; i <= 12; i++) {
    QT.push(i / 13);
}

// Builds the eye outline as a flat [x0,y0,x1,y1,...] point list with ALL pose
// shaping applied (corners, crescent, taper, rotation). Kept as points so the
// head-warp field can deform eyes together with the head art before stringify.
function buildPathPts(p: number[], bx: number): number[] {
    const cx = bx + p[0],
        cy = CY + p[1];
    const w = Math.max(8, p[2]),
        h = Math.max(10, p[3]);
    const x0 = cx - w / 2,
        x1 = cx + w / 2;
    const yT = cy - h / 2,
        yB = cy + h / 2;
    const half = Math.min(w / 2, h / 2);
    const cl = (r: number) => Math.max(3, Math.min(r, half));
    // Squircle corners (RMS-fit to the v3 owl art: SQ=0.75, N_EXP=2.7): saturated
    // radii extend anisotropically toward the full half-extents, so the sides
    // carry continuous curvature instead of capsule-straight segments.
    const SQ = 0.75;
    const cnr = (r: number) => {
        const r0 = cl(r),
            sat = r0 / half;
        return {
            x: r0 + Math.max(0, w / 2 - r0) * sat * SQ,
            y: r0 + Math.max(0, h / 2 - r0) * sat * SQ,
        };
    };
    const rTL = cnr(p[4]),
        rTR = cnr(p[5]),
        rBL = cnr(p[6]),
        rBR = cnr(p[7]);
    const tT = p[8],
        tB = p[9],
        bT = p[10],
        bB = p[11];
    const pts: number[] = [];
    const push = (x: number, y: number) => pts.push(x, y);
    const bumpEdge = (x0e: number, x1e: number, yb: number, amt: number) => {
        for (const u of QT) {
            const s = Math.sin(Math.PI * u);
            push(x0e + (x1e - x0e) * u, yb + amt * s * s);
        }
    };
    push(x0 + rTL.x, yT);
    bumpEdge(x0 + rTL.x, x1 - rTR.x, yT, -bT);
    push(x1 - rTR.x, yT);
    for (let i = 9; i >= 0; i--) {
        push(x1 - rTR.x + rTR.x * CORNER[i][0], yT + rTR.y - rTR.y * CORNER[i][1]);
    }
    push(x1, yB - rBR.y);
    for (let i = 1; i <= 10; i++) {
        push(x1 - rBR.x + rBR.x * CORNER[i][0], yB - rBR.y + rBR.y * CORNER[i][1]);
    }
    bumpEdge(x1 - rBR.x, x0 + rBL.x, yB, bB);
    push(x0 + rBL.x, yB);
    for (let i = 9; i >= 0; i--) {
        push(x0 + rBL.x - rBL.x * CORNER[i][0], yB - rBL.y + rBL.y * CORNER[i][1]);
    }
    push(x0, yT + rTL.y);
    for (let i = 1; i <= 10; i++) {
        push(x0 + rTL.x - rTL.x * CORNER[i][0], yT + rTL.y - rTL.y * CORNER[i][1]);
    }
    const cres = p[13] || 0;
    if (cres > 0.001) {
        crescentBlend(pts, cx, cy, w, h, Math.min(1, cres));
    }
    const rot = (p[12] || 0) * 0.017_453_3;
    const cosR = Math.cos(rot),
        sinR = Math.sin(rot);
    const hw = w / 2,
        hh = Math.max(1, yB - yT);
    for (let i = 0; i < pts.length; i += 2) {
        let x = pts[i],
            y = pts[i + 1];
        let u = (y - yT) / hh;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const fT = (1 - u) * (1 - u),
            fB = u * u;
        y += (tT * fT + tB * fB) * ((x - cx) / hw);
        if (rot) {
            const rx = x - cx,
                ry = y - cy;
            x = cx + rx * cosR - ry * sinR;
            y = cy + rx * sinR + ry * cosR;
        }
        pts[i] = x;
        pts[i + 1] = y;
    }
    return pts;
}
function ptsToD(pts: number[]): string {
    let d = '';
    for (let i = 0; i < pts.length; i += 2) {
        d += `${i === 0 ? 'M' : 'L'}${pts[i].toFixed(1)} ${pts[i + 1].toFixed(1)}`;
    }
    return `${d}Z`;
}
function buildPath(p: number[], bx: number): string {
    return ptsToD(buildPathPts(p, bx));
}
// Per-head eye restyle (HeadSpec.eyeScale) applied to a resolved pose. Size,
// radii, tapers, and bumps scale together so every emotion keeps its read;
// offsets (gaze, rotation, crescent) stay untouched so motion is unchanged.
function applyEyeScale(p: number[], es: { w: number; h: number }): number[] {
    const r = Math.max(es.w, es.h);
    p[2] *= es.w;
    p[3] *= es.h;
    p[4] *= r;
    p[5] *= r;
    p[6] *= r;
    p[7] *= r;
    p[8] *= es.h;
    p[9] *= es.h;
    p[10] *= es.h;
    p[11] *= es.h;
    return p;
}

// slot transform applied numerically (so warped heads can emit eyes in canvas space)
function applySlot(pts: number[], sl: Slot): number[] {
    const tx = 240 * (1 - sl.s) + sl.dx,
        ty = 240 * (1 - sl.s) + sl.dy;
    for (let i = 0; i < pts.length; i += 2) {
        pts[i] = pts[i] * sl.s + tx;
        pts[i + 1] = pts[i + 1] * sl.s + ty;
    }
    return pts;
}

function crescentBlend(pts: number[], cx: number, cy: number, w: number, th: number, k: number) {
    const TH = 2.7925;
    const R = w / 2 / Math.sin(TH / 2);
    const rise = R * (1 - Math.cos(TH / 2));
    const cyA = cy + (R - rise / 2);
    const cl = (u: number): [number, number, number, number, number, number] => {
        const phi = Math.PI / 2 + TH / 2 - TH * u;
        const nx = Math.cos(phi),
            ny = -Math.sin(phi);
        return [cx + R * nx, cyA + R * ny, nx, ny, Math.sin(phi), Math.cos(phi)];
    };
    const thick = (u: number) => th * (0.3 + 0.7 * Math.sin(Math.PI * u) ** 0.8);
    const c2: number[] = [];
    for (let i = 0; i < 26; i++) {
        const u = i / 25,
            q = cl(u),
            r = thick(u) / 2;
        c2.push(q[0] + q[2] * r, q[1] + q[3] * r);
    }
    {
        const q = cl(1),
            r = thick(1) / 2;
        for (let j = 1; j <= 6; j++) {
            const psi = Math.PI / 2 - (Math.PI * j) / 7,
                s = Math.sin(psi),
                c = Math.cos(psi);
            c2.push(q[0] + r * (s * q[2] + c * q[4]), q[1] + r * (s * q[3] + c * q[5]));
        }
    }
    for (let i = 0; i < 30; i++) {
        const u = 1 - i / 29,
            q = cl(u),
            r = thick(u) / 2;
        c2.push(q[0] - q[2] * r, q[1] - q[3] * r);
    }
    {
        const q = cl(0),
            r = thick(0) / 2;
        for (let j = 1; j <= 7; j++) {
            const psi = -Math.PI / 2 + (Math.PI * j) / 8,
                s = Math.sin(psi),
                c = Math.cos(psi);
            c2.push(q[0] + r * (s * q[2] - c * q[4]), q[1] + r * (s * q[3] - c * q[5]));
        }
    }
    for (let i = 0; i < pts.length; i++) {
        pts[i] = pts[i] * (1 - k) + c2[i] * k;
    }
}

// Highlight placement from a resolved eye pose (owl style: tall oval riding the
// upper eye, +6 toward screen-right like the source art's light direction).
// Rides the eye through everything: gaze offsets get a clamped extra "lean",
// height collapse (blinks, closed/squints) squashes then hides it, per-eye size
// differences (curious) give asymmetric highlights for free.
const setPupil = (
    ref: MutableRefObject<SVGEllipseElement | null>,
    p: number[],
    bx: number,
    sl?: Slot,
    wp?: ((x: number, y: number) => [number, number]) | null
) => {
    if (!ref.current) {
        return;
    }
    const w = Math.max(8, p[2]),
        h = Math.max(10, p[3]);
    let rx = w * 0.2,
        ry = w * 0.294;
    const lean = Math.max(-1, Math.min(1, p[0] / 40)) * Math.max(0, Math.min(14, w / 2 - rx - 6));
    const squish = Math.max(0, Math.min(1, (h - 36 * KH) / (D[3] * 0.55)));
    // smiling eyes (big bottom-lift: happy/laughing) are squinted shut with
    // excitement — the highlight fades out with the smile
    const smile = Math.min(1, Math.abs(p[11]) / 34);
    // small eyes fade the highlight instead of
    // floating an off-white blob in a tiny eye
    const sizeFade = Math.max(0, Math.min(1, (h / D[3] - 0.38) / 0.2));
    ry *= 0.55 + 0.45 * squish;
    let cx = bx + p[0] + 6.4 + lean,
        cy = CY + p[1] - h * 0.219;
    if (sl) {
        // warp heads emit in canvas space
        cx = cx * sl.s + 240 * (1 - sl.s) + sl.dx;
        cy = cy * sl.s + 240 * (1 - sl.s) + sl.dy;
        rx *= sl.s;
        ry *= sl.s;
        if (wp) {
            const q = wp(cx, cy);
            cx = q[0];
            cy = q[1];
        }
    }
    ref.current.setAttribute('cx', cx.toFixed(1));
    ref.current.setAttribute('cy', cy.toFixed(1));
    ref.current.setAttribute('rx', rx.toFixed(1));
    ref.current.setAttribute('ry', ry.toFixed(1));
    ref.current.setAttribute(
        'opacity',
        (
            Math.max(0, Math.min(1, (1 - (p[13] || 0)) * squish * 1.4)) *
            (1 - smile) *
            sizeFade
        ).toFixed(3)
    );
};

/* ───────────────────────────────────────────────────────────
   NON-UNIFORM HEAD WARP — infrastructure.
   Head art registers as raw path layers; at module load each layer is
   flattened ONCE into polyline rings in canvas coordinates. Every frame, one
   warp field W(x,y) (quadratic bend + squash-with-bulge, spring-driven)
   deforms head rings, eye outlines, and highlights together, then re-emits
   path data. True deformation — the crown sweeps while the base stays
   planted — with zero per-node authoring.
   ─────────────────────────────────────────────────────────── */
function parseTf(str: string): number[] {
    let M = [1, 0, 0, 1, 0, 0];
    const mul = (A: number[], B: number[]) => [
        A[0] * B[0] + A[2] * B[1],
        A[1] * B[0] + A[3] * B[1],
        A[0] * B[2] + A[2] * B[3],
        A[1] * B[2] + A[3] * B[3],
        A[0] * B[4] + A[2] * B[5] + A[4],
        A[1] * B[4] + A[3] * B[5] + A[5],
    ];
    const re = /(matrix|translate|scale)\(([^)]*)\)/g;
    let m: RegExpExecArray | null = re.exec(str || '');
    while (m) {
        const v = m[2]
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number);
        if (m[1] === 'matrix') {
            M = mul(M, v);
        } else if (m[1] === 'translate') {
            M = mul(M, [1, 0, 0, 1, v[0], v[1] || 0]);
        } else {
            M = mul(M, [v[0], 0, 0, v[1] != null ? v[1] : v[0], 0, 0]);
        }
        m = re.exec(str || '');
    }
    return M;
}
// Flattens a path (M/L/H/V/C/S/Q/Z, abs+rel) into rings of [x,y,...] points.
function flattenD(d: string, M: number[]): number[][] {
    const rings: number[][] = [];
    let ring: number[] = [],
        x = 0,
        y = 0,
        sx = 0,
        sy = 0,
        px = 0,
        py = 0,
        prev = '';
    const put = (X: number, Y: number) => {
        ring.push(M[0] * X + M[2] * Y + M[4], M[1] * X + M[3] * Y + M[5]);
    };
    const cubic = (x1: number, y1: number, x2: number, y2: number, X: number, Y: number) => {
        const dist =
            Math.abs(x1 - x) +
            Math.abs(y1 - y) +
            Math.abs(x2 - x1) +
            Math.abs(y2 - y1) +
            Math.abs(X - x2) +
            Math.abs(Y - y2);
        const n = Math.max(4, Math.min(26, Math.ceil(dist / 7)));
        for (let i = 1; i <= n; i++) {
            const t = i / n,
                mt = 1 - t;
            put(
                mt * mt * mt * x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * X,
                mt * mt * mt * y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * Y
            );
        }
        px = x2;
        py = y2;
        x = X;
        y = Y;
    };
    const re = /([MLHVCSQZmlhvcsqz])([^MLHVCSQZmlhvcsqz]*)/g;
    let m: RegExpExecArray | null = re.exec(d);
    while (m) {
        const c = m[1],
            rel = c === c.toLowerCase();
        const v = m[2]
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number);
        const C = c.toUpperCase();
        let i = 0;
        if (C === 'M') {
            if (ring.length) {
                rings.push(ring);
                ring = [];
            }
            x = rel ? x + v[0] : v[0];
            y = rel ? y + v[1] : v[1];
            sx = x;
            sy = y;
            put(x, y);
            i = 2;
            while (i + 1 < v.length + 1 && i + 1 <= v.length) {
                x = rel ? x + v[i] : v[i];
                y = rel ? y + v[i + 1] : v[i + 1];
                put(x, y);
                i += 2;
            }
        } else if (C === 'L') {
            while (i + 1 <= v.length - 1 + 1 && i + 1 <= v.length) {
                x = rel ? x + v[i] : v[i];
                y = rel ? y + v[i + 1] : v[i + 1];
                put(x, y);
                i += 2;
            }
        } else if (C === 'H') {
            while (i < v.length) {
                x = rel ? x + v[i] : v[i];
                put(x, y);
                i++;
            }
        } else if (C === 'V') {
            while (i < v.length) {
                y = rel ? y + v[i] : v[i];
                put(x, y);
                i++;
            }
        } else if (C === 'C') {
            while (i + 5 < v.length + 1 && i + 5 <= v.length - 0 && i + 5 <= v.length) {
                const ax = rel ? x + v[i] : v[i],
                    ay = rel ? y + v[i + 1] : v[i + 1];
                const bx2 = rel ? x + v[i + 2] : v[i + 2],
                    by2 = rel ? y + v[i + 3] : v[i + 3];
                const X = rel ? x + v[i + 4] : v[i + 4],
                    Y = rel ? y + v[i + 5] : v[i + 5];
                cubic(ax, ay, bx2, by2, X, Y);
                i += 6;
            }
        } else if (C === 'S') {
            while (i + 3 <= v.length) {
                const ax = prev === 'C' || prev === 'S' ? 2 * x - px : x;
                const ay = prev === 'C' || prev === 'S' ? 2 * y - py : y;
                const bx2 = rel ? x + v[i] : v[i],
                    by2 = rel ? y + v[i + 1] : v[i + 1];
                const X = rel ? x + v[i + 2] : v[i + 2],
                    Y = rel ? y + v[i + 3] : v[i + 3];
                cubic(ax, ay, bx2, by2, X, Y);
                i += 4;
            }
        } else if (C === 'Q') {
            while (i + 3 <= v.length) {
                const qx = rel ? x + v[i] : v[i],
                    qy = rel ? y + v[i + 1] : v[i + 1];
                const X = rel ? x + v[i + 2] : v[i + 2],
                    Y = rel ? y + v[i + 3] : v[i + 3];
                cubic(
                    x + (2 / 3) * (qx - x),
                    y + (2 / 3) * (qy - y),
                    X + (2 / 3) * (qx - X),
                    Y + (2 / 3) * (qy - Y),
                    X,
                    Y
                );
                i += 4;
            }
        } else if (C === 'Z') {
            x = sx;
            y = sy;
        }
        prev = C;
        m = re.exec(d);
    }
    if (ring.length) {
        rings.push(ring);
    }
    return rings;
}
const ringsToD = (rings: number[][]): string => {
    let d = '';
    for (const r of rings) {
        for (let i = 0; i < r.length; i += 2) {
            d += `${i === 0 ? 'M' : 'L'}${r[i].toFixed(1)} ${r[i + 1].toFixed(1)}`;
        }
        d += 'Z';
    }
    return d;
};
// Registers warpable art: flattens every layer once, caches rings + base d.
function buildWarpLayers(
    T: string,
    layers: {
        d: string;
        fill: string;
        fillRule?: 'nonzero' | 'evenodd';
        stroke?: string;
        strokeWidth?: number;
    }[]
): WarpLayer[] {
    const M = parseTf(T);
    return layers.map((L) => {
        const rings = flattenD(L.d, M);
        return { ...L, rings, baseD: ringsToD(rings) };
    });
}

const easeInQuad = (p: number) => p * p;
const easeOutBack = (p: number) => {
    const c = 1.2;
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
};
const DROP = 'M0 -16 C7 -6 11 1 11 7 A11 11 0 1 1 -11 7 C-11 1 -7 -6 0 -16 Z';

/* ───────────────────────────────────────────────────────────
   HEADS — silhouette templates. Each returns layers that sit
   behind / in front of the eyes, plus the face slot the eyes
   render into and the eye color for this fill mode.
   All art is authored in the same 480 box as the eyes, so it
   lines up automatically. Swap these for your real Fable art.
   ─────────────────────────────────────────────────────────── */

const INK = '#1b1b1b'; // matches the art fill rgb(27,27,27)
const PAPER = '#ffffff'; // white face / window
const LIGHTEYE = '#ffffff'; // light eyes == face color exactly
const DARKEYE = '#1b1b1b'; // dark eyes == silhouette color exactly
// Owl — first head in style v3 (color + thick outline + white face mask).
// Fable export; eye + highlight subpaths stripped (the engine draws live eyes
// at EYE_FRAME, which was derived from this exact art). Beak is duplicated as a
// front layer so eyes slide BEHIND it during gaze wander.
const OWL_T =
    'matrix(1.112135 0 0 1.11078 240.000045 240.000067) matrix(1 0 0 1 0 0)  translate(-197.287042, -177.406863)';
const OWL_BLACK =
    'M 137.50 351.89 C 89.94 350.54 70.61 347.68 53.00 339.39 C 32.91 329.94 15.19 309.33 8.98 288.20 C 2.50 266.17 1.58 256.45 1.54 209.50 C 1.48 151.03 4.27 130.15 15.24 106.73 L 19.35 97.96 L 17.27 94.23 C 11.77 84.35 12.16 78.15 18.74 70.87 L 22.24 66.99 L 18.45 55.75 C 14.81 44.94 14.66 43.96 14.58 30.50 C 14.49 14.74 16.14 7.61 20.71 4.01 C 25.35 0.36 28.51 1.30 41.52 10.16 C 54.99 19.34 68.24 25.93 78.20 28.41 C 84.28 29.91 85.77 29.93 94.20 28.60 C 99.32 27.79 108.90 26.63 115.50 26.01 C 122.10 25.40 128.18 24.72 129.00 24.50 C 134.85 22.97 189.13 20.82 208.50 21.35 C 246.26 22.39 284.99 25.13 302.50 28.00 C 312.60 29.66 319.26 29.22 327.19 26.38 C 338.83 22.20 351.72 15.86 362.37 9.08 C 373.58 1.95 377.58 1.13 381.61 5.15 C 388.76 12.30 386.11 37.49 375.81 60.16 L 372.78 66.83 L 377.39 71.24 C 381.79 75.46 382.00 75.91 382.00 81.23 C 382.00 85.46 381.29 88.14 379.06 92.39 L 376.12 97.98 L 379.42 105.24 C 386.01 119.70 390.19 139.13 391.97 163.50 C 394.05 191.91 392.93 250.49 389.94 269.50 C 383.37 311.43 360.12 337.35 321.45 345.88 C 294.13 351.90 221.37 354.28 137.50 351.89 Z M 106.50 342.00 C 114.75 342.41 159.52 342.65 206.00 342.53 C 295.04 342.29 303.34 341.92 321.75 337.35 C 349.51 330.45 368.09 313.53 377.01 287.00 C 382.59 270.41 383.12 264.80 383.70 216.00 C 384.28 166.64 383.65 154.11 379.57 134.28 C 376.95 121.50 373.55 111.62 368.83 102.99 L 365.81 97.49 L 369.37 92.20 C 374.24 84.95 375.00 80.53 371.88 77.49 C 370.57 76.21 367.86 74.96 365.86 74.71 C 359.02 73.85 358.67 72.80 363.03 66.45 C 366.76 61.03 373.77 43.81 375.13 36.73 C 377.56 24.12 377.39 12.00 374.80 12.00 C 374.16 12.00 368.98 14.76 363.29 18.12 C 351.26 25.25 334.62 32.86 324.18 36.02 C 316.93 38.22 316.71 38.22 304.18 36.63 C 239.05 28.37 162.25 27.94 107.50 35.54 C 89.19 38.08 83.65 38.35 77.89 37.01 C 65.56 34.14 47.33 24.98 33.13 14.52 C 27.73 10.54 26.54 10.03 25.38 11.19 C 21.68 14.89 21.20 34.70 24.51 47.50 C 25.96 53.11 31.47 65.47 34.14 69.11 C 36.11 71.81 34.47 74.00 30.49 74.00 C 28.02 74.00 26.15 74.76 24.45 76.45 C 20.94 79.97 21.25 84.37 25.50 91.43 C 27.42 94.63 29.00 97.65 29.00 98.14 C 29.00 98.64 27.95 100.72 26.66 102.77 C 19.88 113.55 13.93 135.57 11.55 158.59 C 9.44 179.11 9.39 241.76 11.48 257.55 C 14.13 277.60 17.00 287.74 23.29 299.23 C 33.58 318.01 46.81 329.21 66.50 335.79 C 77.76 339.56 87.42 341.06 106.50 342.00 Z M 198.61 295.23 C 197.45 296.18 196.02 296.97 195.44 296.98 C 193.86 297.01 190.06 292.63 182.45 282.00 C 178.71 276.77 173.25 269.31 170.32 265.41 C 167.23 261.29 165.00 257.28 165.00 255.84 C 165.00 253.25 168.36 248.62 183.00 231.09 C 191.99 220.33 194.58 218.70 198.93 221.12 C 203.11 223.44 227.00 252.79 227.00 255.59 C 227.00 257.91 221.25 267.06 214.49 275.50 C 212.73 277.70 208.91 282.65 206.00 286.50 C 203.09 290.35 199.77 294.28 198.61 295.23 Z';
const OWL_PURPLE =
    'M 106.50 342.00 C 87.42 341.06 77.76 339.56 66.50 335.79 C 46.81 329.21 33.58 318.01 23.29 299.23 C 17.00 287.74 14.13 277.60 11.48 257.55 C 9.39 241.76 9.44 179.11 11.55 158.59 C 13.93 135.57 19.88 113.55 26.66 102.77 C 27.95 100.72 29.00 98.64 29.00 98.14 C 29.00 97.65 27.42 94.63 25.50 91.43 C 21.25 84.37 20.94 79.97 24.45 76.45 C 26.15 74.76 28.02 74.00 30.49 74.00 C 34.47 74.00 36.11 71.81 34.14 69.11 C 31.47 65.47 25.96 53.11 24.51 47.50 C 21.20 34.70 21.68 14.89 25.38 11.19 C 26.54 10.03 27.73 10.54 33.13 14.52 C 47.33 24.98 65.56 34.14 77.89 37.01 C 83.65 38.35 89.19 38.08 107.50 35.54 C 162.25 27.94 239.05 28.37 304.18 36.63 C 316.71 38.22 316.93 38.22 324.18 36.02 C 334.62 32.86 351.26 25.25 363.29 18.12 C 368.98 14.76 374.16 12.00 374.80 12.00 C 377.39 12.00 377.56 24.12 375.13 36.73 C 373.77 43.81 366.76 61.03 363.03 66.45 C 358.67 72.80 359.02 73.85 365.86 74.71 C 367.86 74.96 370.57 76.21 371.88 77.49 C 375.00 80.53 374.24 84.95 369.37 92.20 L 365.81 97.49 L 368.83 102.99 C 373.55 111.62 376.95 121.50 379.57 134.28 C 383.65 154.11 384.28 166.64 383.70 216.00 C 383.12 264.80 382.59 270.41 377.01 287.00 C 368.09 313.53 349.51 330.45 321.75 337.35 C 303.34 341.92 295.04 342.29 206.00 342.53 C 159.52 342.65 114.75 342.41 106.50 342.00 Z M 180.50 330.41 C 187.23 331.40 216.15 329.94 227.07 328.06 C 252.00 323.77 275.40 314.17 294.91 300.23 C 311.96 288.05 323.70 275.08 332.40 258.84 C 341.13 242.52 344.73 227.11 345.69 201.94 C 347.08 165.47 336.82 139.79 315.22 125.74 C 302.43 117.42 289.47 113.49 274.87 113.52 C 268.91 113.53 263.20 114.04 261.87 114.69 C 260.57 115.32 256.63 116.77 253.13 117.90 C 236.07 123.40 217.77 138.89 204.55 159.04 C 200.78 164.79 197.38 169.85 197.00 170.29 C 196.63 170.72 194.09 167.57 191.36 163.29 C 180.48 146.24 164.89 130.39 151.98 123.26 C 124.26 107.95 88.81 112.22 67.39 133.45 C 61.68 139.11 59.38 142.37 55.73 150.00 C 49.65 162.70 48.09 169.80 47.38 188.11 C 46.19 218.99 49.73 238.11 60.46 258.77 C 69.55 276.28 81.05 288.61 100.18 301.35 C 124.11 317.29 146.59 325.42 180.50 330.41 Z';
const OWL_ACCENT =
    'M 306.91 120.97 C 303.37 119.31 299.60 117.91 295.60 116.77 C 285.23 113.83 267.01 113.91 256.32 116.83 C 258.76 115.97 260.96 115.13 261.87 114.69 C 263.20 114.04 268.91 113.53 274.87 113.52 C 286.32 113.50 296.76 115.91 306.91 120.97 Z M 267.38 315.91 C 269.09 315.12 270.80 314.31 272.50 313.45 C 287.11 306.15 300.74 296.68 311.38 286.64 C 306.51 291.35 301.06 295.84 294.91 300.23 C 286.41 306.31 277.16 311.56 267.38 315.91 Z M 339.25 155.87 C 335.04 145.64 329.23 137.25 321.81 130.69 C 329.43 137.28 335.25 145.69 339.25 155.87 Z M 180.50 330.41 C 182.14 330.65 190.60 330.66 199.36 330.44 C 191.02 330.80 183.52 330.85 180.50 330.41 Z M 250.70 118.74 C 243.59 121.55 236.61 125.65 229.97 130.87 C 236.76 125.49 243.80 121.33 250.70 118.74 Z M 330.07 262.99 C 332.88 258.06 335.53 252.70 337.50 247.93 C 336.04 251.60 334.35 255.20 332.40 258.84 C 331.64 260.25 330.87 261.63 330.07 262.99 Z M 221.43 328.83 C 224.43 328.45 227.37 328.00 230.26 327.48 C 229.20 327.69 228.14 327.88 227.07 328.06 C 225.52 328.33 223.60 328.59 221.43 328.83 Z M 341.21 236.72 C 342.16 233.06 342.96 229.17 343.62 225.14 C 342.98 229.23 342.18 233.06 341.21 236.72 Z';
const OWL_WHITE =
    'M 180.50 330.41 C 146.59 325.42 124.11 317.29 100.18 301.35 C 81.05 288.61 69.55 276.28 60.46 258.77 C 49.73 238.11 46.19 218.99 47.38 188.11 C 48.09 169.80 49.65 162.70 55.73 150.00 C 59.38 142.37 61.68 139.11 67.39 133.45 C 88.81 112.22 124.26 107.95 151.98 123.26 C 164.89 130.39 180.48 146.24 191.36 163.29 C 194.09 167.57 196.63 170.72 197.00 170.29 C 197.38 169.85 200.78 164.79 204.55 159.04 C 218.20 138.24 236.22 123.26 254.79 117.28 C 265.19 113.93 284.72 113.69 295.60 116.77 C 318.05 123.15 333.17 137.75 341.07 160.70 C 348.08 181.09 347.29 219.22 339.36 243.00 C 336.40 251.88 329.57 264.94 323.77 272.84 C 312.86 287.68 293.70 302.85 272.50 313.45 C 250.46 324.47 227.96 329.71 199.57 330.44 C 190.73 330.66 182.15 330.65 180.50 330.41 Z M 198.61 295.23 C 199.77 294.28 203.09 290.35 206.00 286.50 C 208.91 282.65 212.73 277.70 214.49 275.50 C 221.25 267.06 227.00 257.91 227.00 255.59 C 227.00 252.79 203.11 223.44 198.93 221.12 C 194.58 218.70 191.99 220.33 183.00 231.09 C 168.36 248.62 165.00 253.25 165.00 255.84 C 165.00 257.28 167.23 261.29 170.32 265.41 C 173.25 269.31 178.71 276.77 182.45 282.00 C 190.06 292.63 193.86 297.01 195.44 296.98 C 196.02 296.97 197.45 296.18 198.61 295.23 Z';
const OWL_BEAK =
    'M 198.61 295.23 C 197.45 296.18 196.02 296.97 195.44 296.98 C 193.86 297.01 190.06 292.63 182.45 282.00 C 178.71 276.77 173.25 269.31 170.32 265.41 C 167.23 261.29 165.00 257.28 165.00 255.84 C 165.00 253.25 168.36 248.62 183.00 231.09 C 191.99 220.33 194.58 218.70 198.93 221.12 C 203.11 223.44 227.00 252.79 227.00 255.59 C 227.00 257.91 221.25 267.06 214.49 275.50 C 212.73 277.70 208.91 282.65 206.00 286.50 C 203.09 290.35 199.77 294.28 198.61 295.23 Z';
// Warpable layers: flattened once at module load into canvas-space rings.
const OWL_WARP = {
    back: buildWarpLayers(OWL_T, [
        { d: OWL_BLACK, fill: 'rgb(7,7,8)', fillRule: 'evenodd' },
        { d: OWL_PURPLE, fill: 'rgb(87,58,165)', fillRule: 'evenodd' },
        { d: OWL_ACCENT, fill: 'rgb(158,149,180)', fillRule: 'evenodd' },
        { d: OWL_WHITE, fill: 'rgb(252,252,253)', fillRule: 'evenodd' },
    ]),
    front: buildWarpLayers(OWL_T, [{ d: OWL_BEAK, fill: 'rgb(7,7,8)' }]),
};

// Knight v3 (Fable export, taller-than-frame canvas — the plume rides above
// the 480 square and leans out via overflow:visible; chip crops trim it).
// Fit computed to land its eye sockets exactly on EYE_FRAME. Eye + highlight
// subpaths stripped (incl. two gray highlight-rim artifacts in the helmet
// layer); the engine draws live eyes in the visor.
const KNIGHT_T =
    'translate(-9.456 -145.653) scale(1.03725) matrix(1.242437 0 0 1.247878 240.126396 317.045692) matrix(1 0 0 1 0 0)  translate(-205.975418, -213.760052)';
const KN_BLACK =
    'M 149.50 417.02 C 102.00 415.06 79.90 411.40 61.50 402.44 C 51.89 397.76 46.06 393.22 39.45 385.27 C 32.93 377.41 29.93 371.92 26.63 361.79 C 23.68 352.75 23.11 348.60 22.01 328.50 C 21.54 319.70 20.64 310.48 20.02 308.00 C 19.40 305.52 18.64 292.48 18.33 279.00 C 17.87 258.87 18.06 252.97 19.38 245.92 C 20.27 241.20 21.00 236.18 21.00 234.76 C 21.00 232.12 25.90 227.00 28.42 227.00 C 29.12 227.00 31.67 225.95 34.09 224.67 C 38.49 222.35 38.50 222.34 38.72 216.42 C 39.78 188.19 45.27 171.23 58.71 154.76 C 77.54 131.69 110.96 112.40 146.50 104.11 C 164.66 99.87 180.42 97.21 190.00 96.76 L 195.50 96.50 L 196.18 87.50 C 197.12 75.04 199.31 67.46 206.05 53.43 C 210.76 43.63 213.19 39.92 218.96 33.75 C 234.14 17.50 252.01 10.00 275.56 10.00 C 292.83 10.00 303.94 13.74 312.14 22.32 C 315.14 25.46 318.00 32.58 317.98 36.83 C 317.95 41.49 314.76 48.60 310.90 52.59 L 307.92 55.68 L 314.65 61.09 C 323.11 67.89 327.04 74.63 327.76 83.56 C 328.17 88.65 327.85 90.68 326.09 94.30 C 323.84 98.96 318.51 103.38 313.75 104.55 C 310.53 105.33 310.47 105.63 312.64 109.97 C 313.54 111.78 314.50 115.22 314.77 117.63 C 315.23 121.70 315.64 122.22 320.68 125.11 C 323.67 126.81 329.57 130.78 333.80 133.92 C 360.32 153.61 371.70 175.43 373.65 210.30 C 374.22 220.38 374.58 222.24 376.18 223.09 C 380.71 225.52 389.27 232.63 390.46 234.95 C 393.59 241.06 394.15 248.36 393.72 277.50 C 392.90 334.32 390.21 355.94 381.95 372.30 C 374.86 386.31 364.51 396.25 349.50 403.44 C 335.21 410.28 327.39 412.11 299.91 415.03 C 284.61 416.66 272.05 417.07 225.50 417.42 C 194.70 417.65 160.50 417.47 149.50 417.02 Z M 145.00 408.37 C 148.57 408.56 182.10 408.61 219.50 408.49 C 281.52 408.28 289.04 408.07 305.00 406.15 C 330.52 403.08 343.59 399.04 355.55 390.50 C 368.09 381.55 375.75 369.95 380.03 353.42 C 382.38 344.36 383.87 326.00 382.27 326.00 C 381.70 326.00 379.63 326.67 377.65 327.50 C 371.96 329.88 363.67 329.48 360.39 326.66 C 355.95 322.84 357.62 321.00 365.51 321.00 C 373.35 321.00 379.20 318.45 381.48 314.03 C 384.79 307.64 386.00 297.42 385.98 276.18 C 385.95 245.18 384.11 236.30 377.00 232.76 C 374.92 231.73 371.72 231.12 369.12 231.26 C 363.72 231.56 361.53 229.28 364.29 226.23 C 366.51 223.78 366.60 211.65 364.49 198.75 C 362.44 186.26 361.46 183.14 355.92 171.50 C 352.10 163.47 349.56 159.79 343.05 152.81 C 333.67 142.75 324.73 136.39 306.81 127.01 C 300.39 123.65 277.57 115.01 268.50 112.50 C 265.20 111.59 261.15 110.46 259.50 109.99 C 249.43 107.13 231.46 105.54 209.00 105.52 C 178.78 105.50 165.32 107.36 138.00 115.33 C 111.95 122.93 90.80 134.65 73.62 151.00 C 60.75 163.25 54.41 174.15 49.58 192.30 C 46.15 205.17 45.86 221.66 49.00 224.50 C 53.28 228.37 50.77 232.20 44.51 231.35 C 41.66 230.96 39.34 231.29 37.20 232.40 C 28.09 237.11 27.00 241.69 27.01 275.15 C 27.02 308.98 28.11 313.56 37.24 318.53 C 41.71 320.96 42.90 321.18 48.50 320.61 C 53.93 320.05 54.86 320.20 55.45 321.73 C 55.93 322.97 55.21 324.32 53.05 326.25 C 49.21 329.68 42.43 329.97 35.50 327.00 C 32.93 325.90 30.65 325.00 30.42 325.00 C 28.63 325.00 31.76 351.57 34.49 359.63 C 42.12 382.08 61.27 397.41 88.52 402.87 C 97.23 404.61 125.15 407.33 145.00 408.37 Z M 252.00 357.55 C 235.41 359.37 192.24 360.19 178.00 358.97 C 160.24 357.43 131.09 353.92 124.63 352.53 C 115.45 350.55 102.30 346.15 95.16 342.68 C 79.46 335.04 74.34 324.00 72.40 293.58 C 71.66 282.04 73.41 259.73 75.59 252.91 C 77.42 247.16 80.51 244.21 90.00 239.16 C 108.31 229.39 148.90 219.64 182.50 216.93 C 224.71 213.53 271.13 219.63 307.21 233.32 C 324.07 239.73 332.99 244.83 335.68 249.62 C 338.19 254.07 341.00 272.77 341.00 284.96 C 341.00 296.35 338.14 318.55 335.91 324.51 C 333.01 332.26 327.40 338.07 318.80 342.22 C 302.15 350.25 287.04 353.72 252.00 357.55 Z M 178.00 349.89 C 202.04 351.16 214.77 351.08 237.50 349.55 C 259.24 348.09 266.24 347.24 283.94 343.91 C 308.83 339.23 323.45 332.04 327.43 322.52 C 332.20 311.09 333.77 275.48 330.18 260.00 L 328.44 252.50 L 318.40 247.50 C 303.25 239.96 281.33 233.11 259.00 228.95 C 235.16 224.50 200.36 222.69 183.00 224.98 C 150.12 229.32 146.76 229.89 129.50 234.08 C 106.80 239.58 86.80 248.04 84.24 253.22 C 79.96 261.89 80.19 307.52 84.59 320.98 C 85.45 323.60 87.58 327.11 89.32 328.77 C 92.83 332.10 102.02 337.02 109.03 339.34 C 120.93 343.26 157.03 348.78 178.00 349.89 Z M 298.00 113.90 C 305.59 117.41 306.00 117.49 306.00 115.46 C 306.00 112.76 302.97 109.19 297.92 105.95 C 289.92 100.82 291.66 98.00 302.83 98.00 C 308.62 98.00 311.01 97.54 313.64 95.91 C 318.14 93.13 319.00 91.25 319.00 84.14 C 319.00 78.91 318.58 77.61 315.70 73.83 C 310.64 67.19 303.11 63.91 291.16 63.13 C 283.12 62.60 281.47 62.21 281.19 60.77 C 280.85 58.99 284.01 57.20 294.33 53.32 C 312.31 46.55 313.83 29.96 297.21 21.78 C 290.60 18.53 290.41 18.50 276.02 18.50 C 260.14 18.50 255.35 19.41 245.50 24.29 C 224.75 34.58 210.63 52.97 205.40 76.50 C 203.65 84.40 203.56 95.99 205.25 96.03 C 220.83 96.44 245.26 98.31 251.00 99.53 C 268.46 103.25 287.71 109.13 298.00 113.90 Z M 211.35 192.55 C 207.99 195.67 205.91 195.64 202.08 192.41 L 199.00 189.82 L 199.00 164.99 C 199.00 151.34 199.28 139.44 199.62 138.54 C 200.35 136.65 205.09 134.00 207.76 134.00 C 208.79 134.00 210.61 134.92 211.81 136.04 C 213.95 138.04 214.00 138.62 214.00 164.09 L 214.00 190.10 Z M 157.55 198.55 C 156.20 199.90 153.93 201.00 152.50 201.00 C 151.07 201.00 148.80 199.90 147.45 198.55 L 145.00 196.09 L 145.00 146.91 L 147.45 144.45 C 150.45 141.45 153.87 141.32 157.37 144.07 L 160.00 146.15 L 160.00 196.09 Z M 265.93 198.37 C 263.14 201.91 258.74 201.90 255.45 198.35 L 253.00 195.71 L 253.00 171.58 C 253.00 143.56 253.15 143.00 260.50 143.00 C 267.85 143.00 268.00 143.56 268.00 171.59 C 268.00 194.50 267.89 195.86 265.93 198.37 Z M 314.14 210.09 C 310.86 212.74 307.35 212.48 304.45 209.35 C 302.01 206.72 302.00 206.64 302.00 185.32 C 302.00 160.15 302.33 159.00 309.59 159.00 C 316.91 159.00 317.16 159.96 316.80 186.00 C 316.50 207.93 316.47 208.20 314.14 210.09 Z M 106.69 209.83 C 103.79 212.54 99.62 212.62 97.00 210.00 C 95.12 208.12 95.00 206.67 95.00 186.00 C 95.00 165.33 95.12 163.88 97.00 162.00 C 99.43 159.57 105.19 159.34 107.43 161.57 C 108.76 162.91 109.00 166.50 109.00 185.40 C 109.00 207.37 108.97 207.68 106.69 209.83 Z M 50.53 289.80 C 46.52 291.63 45.09 291.29 41.40 287.60 C 38.45 284.65 38.00 283.55 38.00 279.25 C 38.00 269.39 41.43 264.00 47.71 264.00 C 50.32 264.00 51.93 264.78 54.10 267.11 C 56.56 269.74 57.00 271.03 57.00 275.65 C 57.00 282.16 54.29 288.09 50.53 289.80 Z M 370.00 289.50 C 362.40 293.43 357.00 288.44 357.00 277.50 C 357.00 268.07 360.94 263.20 367.56 264.45 C 372.43 265.36 375.00 269.14 374.99 275.38 C 374.99 283.20 373.38 287.75 370.00 289.50 Z M 174.00 399.00 C 171.59 401.41 171.08 401.45 168.22 399.44 C 166.12 397.97 166.00 397.18 166.00 385.10 C 166.00 373.98 166.24 372.09 167.83 370.65 C 170.21 368.50 172.29 368.56 174.35 370.83 C 175.69 372.32 176.00 374.91 176.00 384.83 C 176.00 395.67 175.78 397.22 174.00 399.00 Z M 247.07 399.96 C 244.27 401.46 242.53 401.25 240.65 399.17 C 239.32 397.70 239.00 395.16 239.00 386.11 C 239.00 373.46 239.79 371.00 243.84 371.00 C 248.54 371.00 249.00 372.35 249.00 386.16 C 249.00 397.76 248.82 399.02 247.07 399.96 Z M 282.17 396.35 C 279.66 398.61 277.41 398.42 275.56 395.78 C 273.30 392.56 273.31 371.83 275.57 369.57 C 277.40 367.74 279.35 367.58 282.07 369.04 C 283.82 369.97 284.00 371.23 284.00 382.38 C 284.00 393.04 283.75 394.91 282.17 396.35 Z M 209.58 398.91 C 207.26 401.48 205.80 401.54 203.65 399.17 C 202.31 397.68 202.00 395.11 202.00 385.37 C 202.00 372.40 202.50 371.00 207.16 371.00 C 211.42 371.00 212.26 373.73 211.84 386.04 C 211.54 394.87 211.13 397.20 209.58 398.91 Z M 136.42 395.39 C 133.65 396.46 131.23 396.05 130.61 394.42 C 130.27 393.55 130.00 388.01 130.00 382.11 C 130.00 369.82 130.99 367.28 135.34 368.37 L 138.00 369.04 L 138.00 381.91 C 138.00 392.73 137.75 394.88 136.42 395.39 Z';
const KN_PURPLE =
    'M 298.00 113.90 C 287.71 109.13 268.46 103.25 251.00 99.53 C 245.26 98.31 220.83 96.44 205.25 96.03 C 203.56 95.99 203.65 84.40 205.40 76.50 C 210.63 52.97 224.75 34.58 245.50 24.29 C 255.35 19.41 260.14 18.50 276.02 18.50 C 290.41 18.50 290.60 18.53 297.21 21.78 C 313.83 29.96 312.31 46.55 294.33 53.32 C 284.01 57.20 280.85 58.99 281.19 60.77 C 281.47 62.21 283.12 62.60 291.16 63.13 C 303.11 63.91 310.64 67.19 315.70 73.83 C 318.58 77.61 319.00 78.91 319.00 84.14 C 319.00 91.25 318.14 93.13 313.64 95.91 C 311.01 97.54 308.62 98.00 302.83 98.00 C 291.66 98.00 289.92 100.82 297.92 105.95 C 302.97 109.19 306.00 112.76 306.00 115.46 C 306.00 117.49 305.59 117.41 298.00 113.90 Z M 138.00 395.50 C 136.51 397.30 131.88 397.48 130.20 395.80 C 129.40 395.00 129.00 390.57 129.00 382.45 C 129.00 371.96 129.25 370.09 130.83 368.65 C 133.48 366.25 136.70 366.62 138.62 369.54 C 140.00 371.65 140.19 373.90 139.76 383.04 C 139.45 389.57 138.74 394.61 138.00 395.50 Z M 136.42 395.39 C 137.75 394.88 138.00 392.73 138.00 381.91 L 138.00 369.04 L 135.34 368.37 C 130.99 367.28 130.00 369.82 130.00 382.11 C 130.00 388.01 130.27 393.55 130.61 394.42 C 131.23 396.05 133.65 396.46 136.42 395.39 Z';
const KN_GRAY =
    'M 145.00 408.37 C 125.15 407.33 97.23 404.61 88.52 402.87 C 61.27 397.41 42.12 382.08 34.49 359.63 C 31.76 351.57 28.63 325.00 30.42 325.00 C 30.65 325.00 32.93 325.90 35.50 327.00 C 42.43 329.97 49.21 329.68 53.05 326.25 C 55.21 324.32 55.93 322.97 55.45 321.73 C 54.86 320.20 53.93 320.05 48.50 320.61 C 42.90 321.18 41.71 320.96 37.24 318.53 C 28.11 313.56 27.02 308.98 27.01 275.15 C 27.00 241.69 28.09 237.11 37.20 232.40 C 39.34 231.29 41.66 230.96 44.51 231.35 C 50.77 232.20 53.28 228.37 49.00 224.50 C 45.86 221.66 46.15 205.17 49.58 192.30 C 54.41 174.15 60.75 163.25 73.62 151.00 C 90.80 134.65 111.95 122.93 138.00 115.33 C 165.32 107.36 178.78 105.50 209.00 105.52 C 231.46 105.54 249.43 107.13 259.50 109.99 C 261.15 110.46 265.20 111.59 268.50 112.50 C 277.57 115.01 300.39 123.65 306.81 127.01 C 324.73 136.39 333.67 142.75 343.05 152.81 C 349.56 159.79 352.10 163.47 355.92 171.50 C 361.46 183.14 362.44 186.26 364.49 198.75 C 366.60 211.65 366.51 223.78 364.29 226.23 C 361.53 229.28 363.72 231.56 369.12 231.26 C 371.72 231.12 374.92 231.73 377.00 232.76 C 384.11 236.30 385.95 245.18 385.98 276.18 C 386.00 297.42 384.79 307.64 381.48 314.03 C 379.20 318.45 373.35 321.00 365.51 321.00 C 357.62 321.00 355.95 322.84 360.39 326.66 C 363.67 329.48 371.96 329.88 377.65 327.50 C 379.63 326.67 381.70 326.00 382.27 326.00 C 383.87 326.00 382.38 344.36 380.03 353.42 C 375.75 369.95 368.09 381.55 355.55 390.50 C 343.59 399.04 330.52 403.08 305.00 406.15 C 289.04 408.07 281.52 408.28 219.50 408.49 C 182.10 408.61 148.57 408.56 145.00 408.37 Z M 252.00 357.55 C 287.04 353.72 302.15 350.25 318.80 342.22 C 327.40 338.07 333.01 332.26 335.91 324.51 C 338.14 318.55 341.00 296.35 341.00 284.96 C 341.00 272.77 338.19 254.07 335.68 249.62 C 332.99 244.83 324.07 239.73 307.21 233.32 C 271.13 219.63 224.71 213.53 182.50 216.93 C 148.90 219.64 108.31 229.39 90.00 239.16 C 80.51 244.21 77.42 247.16 75.59 252.91 C 73.41 259.73 71.66 282.04 72.40 293.58 C 74.34 324.00 79.46 335.04 95.16 342.68 C 102.30 346.15 115.45 350.55 124.63 352.53 C 131.09 353.92 160.24 357.43 178.00 358.97 C 192.24 360.19 235.41 359.37 252.00 357.55 Z M 211.35 192.55 L 214.00 190.10 L 214.00 164.09 C 214.00 138.62 213.95 138.04 211.81 136.04 C 210.61 134.92 208.79 134.00 207.76 134.00 C 205.09 134.00 200.35 136.65 199.62 138.54 C 199.28 139.44 199.00 151.34 199.00 164.99 L 199.00 189.82 L 202.08 192.41 C 205.91 195.64 207.99 195.67 211.35 192.55 Z M 157.55 198.55 L 160.00 196.09 L 160.00 146.15 L 157.37 144.07 C 153.87 141.32 150.45 141.45 147.45 144.45 L 145.00 146.91 L 145.00 196.09 L 147.45 198.55 C 148.80 199.90 151.07 201.00 152.50 201.00 C 153.93 201.00 156.20 199.90 157.55 198.55 Z M 265.93 198.37 C 267.89 195.86 268.00 194.50 268.00 171.59 C 268.00 143.56 267.85 143.00 260.50 143.00 C 253.15 143.00 253.00 143.56 253.00 171.58 L 253.00 195.71 L 255.45 198.35 C 258.74 201.90 263.14 201.91 265.93 198.37 Z M 314.14 210.09 C 316.47 208.20 316.50 207.93 316.80 186.00 C 317.16 159.96 316.91 159.00 309.59 159.00 C 302.33 159.00 302.00 160.15 302.00 185.32 C 302.00 206.64 302.01 206.72 304.45 209.35 C 307.35 212.48 310.86 212.74 314.14 210.09 Z M 106.69 209.83 C 108.97 207.68 109.00 207.37 109.00 185.40 C 109.00 166.50 108.76 162.91 107.43 161.57 C 105.19 159.34 99.43 159.57 97.00 162.00 C 95.12 163.88 95.00 165.33 95.00 186.00 C 95.00 206.67 95.12 208.12 97.00 210.00 C 99.62 212.62 103.79 212.54 106.69 209.83 Z M 50.53 289.80 C 54.29 288.09 57.00 282.16 57.00 275.65 C 57.00 271.03 56.56 269.74 54.10 267.11 C 51.93 264.78 50.32 264.00 47.71 264.00 C 41.43 264.00 38.00 269.39 38.00 279.25 C 38.00 283.55 38.45 284.65 41.40 287.60 C 45.09 291.29 46.52 291.63 50.53 289.80 Z M 370.00 289.50 C 373.38 287.75 374.99 283.20 374.99 275.38 C 375.00 269.14 372.43 265.36 367.56 264.45 C 360.94 263.20 357.00 268.07 357.00 277.50 C 357.00 288.44 362.40 293.43 370.00 289.50 Z M 138.00 395.50 C 138.74 394.61 139.45 389.57 139.76 383.04 C 140.19 373.90 140.00 371.65 138.62 369.54 C 136.70 366.62 133.48 366.25 130.83 368.65 C 129.25 370.09 129.00 371.96 129.00 382.45 C 129.00 390.57 129.40 395.00 130.20 395.80 C 131.88 397.48 136.51 397.30 138.00 395.50 Z M 174.00 399.00 C 175.78 397.22 176.00 395.67 176.00 384.83 C 176.00 374.91 175.69 372.32 174.35 370.83 C 172.29 368.56 170.21 368.50 167.83 370.65 C 166.24 372.09 166.00 373.98 166.00 385.10 C 166.00 397.18 166.12 397.97 168.22 399.44 C 171.08 401.45 171.59 401.41 174.00 399.00 Z M 247.07 399.96 C 248.82 399.02 249.00 397.76 249.00 386.16 C 249.00 372.35 248.54 371.00 243.84 371.00 C 239.79 371.00 239.00 373.46 239.00 386.11 C 239.00 395.16 239.32 397.70 240.65 399.17 C 242.53 401.25 244.27 401.46 247.07 399.96 Z M 282.17 396.35 C 283.75 394.91 284.00 393.04 284.00 382.38 C 284.00 371.23 283.82 369.97 282.07 369.04 C 279.35 367.58 277.40 367.74 275.57 369.57 C 273.31 371.83 273.30 392.56 275.56 395.78 C 277.41 398.42 279.66 398.61 282.17 396.35 Z M 209.58 398.91 C 211.13 397.20 211.54 394.87 211.84 386.04 C 212.26 373.73 211.42 371.00 207.16 371.00 C 202.50 371.00 202.00 372.40 202.00 385.37 C 202.00 395.11 202.31 397.68 203.65 399.17 C 205.80 401.54 207.26 401.48 209.58 398.91 Z';
const KN_WHITE =
    'M 178.00 349.89 C 157.03 348.78 120.93 343.26 109.03 339.34 C 102.02 337.02 92.83 332.10 89.32 328.77 C 87.58 327.11 85.45 323.60 84.59 320.98 C 80.19 307.52 79.96 261.89 84.24 253.22 C 86.80 248.04 106.80 239.58 129.50 234.08 C 146.76 229.89 150.12 229.32 183.00 224.98 C 200.36 222.69 235.16 224.50 259.00 228.95 C 281.33 233.11 303.25 239.96 318.40 247.50 L 328.44 252.50 L 330.18 260.00 C 333.77 275.48 332.20 311.09 327.43 322.52 C 323.45 332.04 308.83 339.23 283.94 343.91 C 266.24 347.24 259.24 348.09 237.50 349.55 C 214.77 351.08 202.04 351.16 178.00 349.89 Z';
const KNIGHT_WARP = {
    back: buildWarpLayers(KNIGHT_T, [
        { d: KN_BLACK, fill: 'rgb(12,12,12)', fillRule: 'evenodd' },
        { d: KN_PURPLE, fill: 'rgb(78,62,132)', fillRule: 'evenodd' },
        { d: KN_GRAY, fill: 'rgb(167,166,166)', fillRule: 'evenodd' },
        { d: KN_WHITE, fill: 'rgb(254,254,254)', fillRule: 'evenodd' },
    ]),
    front: [],
};

// Bird v3 (Fable export): blue body, twin white eye patches, beak duplicated
// as a front occluder. Eyes CLIP to the patches — at gaze extremes they cut
// against the socket edge instead of sliding onto the blue body.
const BIRD_T =
    'translate(-5.982 -156.234) scale(1.02065) matrix(1.093033 0 0 1.091992 240.183738 353.699378) matrix(1 0 0 1 -0.168237 -0.715009)  translate(-207.999961, -206.982239)';
const BIRD_BLUE_D =
    'M 297.04 402.52 C 282.38 403.63 262.53 403.95 217.50 403.80 C 151.08 403.57 148.00 403.51 123.00 402.00 C 87.76 399.88 72.44 394.32 55.40 377.50 C 48.32 370.51 46.58 368.04 41.66 358.00 C 37.75 350.01 35.54 343.95 34.40 338.15 L 32.78 329.79 L 37.48 325.02 C 44.77 317.62 42.00 312.67 34.08 318.94 C 26.23 325.15 18.52 326.44 14.68 322.19 C 9.72 316.72 8.65 305.27 11.98 293.50 C 14.54 284.48 20.94 271.52 26.01 265.11 L 30.00 260.06 L 30.00 224.78 C 30.01 157.65 34.25 137.10 53.21 112.28 C 66.41 95.00 96.51 81.60 124.00 80.76 L 132.50 80.50 L 132.03 83.50 C 131.77 85.15 131.54 89.88 131.53 94.00 C 131.50 100.63 131.71 101.50 133.35 101.50 C 134.82 101.50 135.84 99.38 138.41 91.00 C 146.72 63.87 159.87 45.11 182.31 28.34 C 213.20 5.28 244.00 3.89 245.79 25.49 C 246.48 33.79 240.16 47.33 229.78 59.82 C 227.18 62.94 225.04 66.06 225.03 66.75 C 224.98 68.99 228.69 68.07 233.89 64.57 C 242.08 59.06 257.33 51.12 265.21 48.26 C 274.16 45.01 284.73 44.60 289.73 47.29 C 296.32 50.84 297.73 58.74 293.43 67.98 C 291.57 71.97 287.38 76.99 277.94 86.52 C 270.82 93.71 265.00 99.91 265.00 100.30 C 265.00 103.80 280.95 94.90 290.05 86.31 L 297.02 79.74 L 304.99 80.44 C 316.45 81.44 330.07 85.30 340.94 90.64 C 348.77 94.48 351.87 96.76 359.01 103.89 C 371.71 116.57 378.08 129.69 382.14 151.50 C 383.96 161.31 384.24 167.81 384.71 211.50 L 385.23 260.50 L 388.08 263.75 C 395.14 271.79 402.36 285.21 404.49 294.23 C 407.57 307.31 405.68 317.95 399.38 322.93 C 395.34 326.11 388.88 325.41 382.50 321.10 C 374.80 315.91 372.25 318.95 378.50 325.87 C 381.43 329.11 382.00 330.49 382.00 334.32 C 382.00 351.39 370.70 371.67 354.06 384.44 C 338.90 396.08 325.33 400.39 297.04 402.52 Z M 201.07 362.27 C 205.25 367.34 208.59 367.31 213.24 362.15 C 216.07 359.02 217.26 358.38 219.61 358.72 C 221.20 358.96 237.57 358.67 256.00 358.10 C 294.33 356.90 301.40 355.77 310.76 349.35 C 320.85 342.43 325.54 334.94 329.74 319.08 C 332.18 309.87 332.29 308.10 332.73 273.22 C 333.21 235.05 332.78 229.65 328.24 217.00 C 321.24 197.48 304.53 186.05 283.00 186.05 C 260.11 186.05 245.01 197.41 238.57 219.50 C 237.60 222.80 236.38 226.95 235.85 228.73 C 233.23 237.50 231.85 299.45 234.22 301.82 C 234.90 302.50 232.76 302.06 229.47 300.86 C 224.25 298.94 221.55 298.68 208.00 298.73 C 194.34 298.78 191.64 299.07 185.28 301.21 C 180.60 302.78 178.45 303.16 179.18 302.29 C 179.95 301.36 180.29 290.97 180.28 268.72 C 180.26 239.48 180.06 235.62 178.12 227.00 C 171.89 199.34 156.60 186.00 131.11 186.00 C 110.50 186.00 95.48 194.48 87.58 210.59 C 84.79 216.28 83.95 218.79 81.94 227.50 C 79.09 239.83 80.15 305.32 83.40 318.00 C 89.31 341.03 99.85 351.12 122.52 355.44 C 132.81 357.40 166.74 358.78 185.75 358.00 C 192.49 357.73 198.00 357.73 198.00 358.02 C 198.00 358.31 199.38 360.22 201.07 362.27 Z';
const BIRD_BLACK_D =
    'M 164.50 412.34 C 102.14 410.30 87.77 408.18 68.58 398.16 C 48.12 387.47 32.55 367.09 26.79 343.46 C 25.59 338.53 24.14 334.17 23.55 333.77 C 22.97 333.36 20.88 333.02 18.90 333.02 C 12.26 332.99 5.34 326.35 2.81 317.60 C 0.95 311.14 1.55 297.55 4.06 289.50 C 6.82 280.61 12.66 269.05 17.91 262.07 L 22.00 256.64 L 22.00 217.03 C 22.00 173.80 22.90 161.92 27.48 145.11 C 32.66 126.09 41.17 111.68 54.77 98.92 C 71.88 82.86 94.44 74.39 125.45 72.39 L 136.06 71.70 L 140.66 63.27 C 152.09 42.29 169.17 24.96 190.50 12.69 C 203.37 5.29 212.51 2.61 225.00 2.55 C 233.92 2.51 236.27 2.85 240.65 4.83 C 246.58 7.51 248.92 9.77 252.05 15.84 C 255.00 21.55 255.07 31.35 252.22 38.75 C 251.10 41.64 250.56 44.00 251.01 44.00 C 251.46 44.00 256.69 42.37 262.63 40.39 C 272.34 37.14 274.25 36.82 281.47 37.21 C 290.09 37.68 293.81 39.10 298.41 43.66 C 303.99 49.18 305.87 58.81 303.04 67.37 C 302.36 69.44 301.97 71.31 302.18 71.52 C 302.39 71.73 307.39 72.62 313.28 73.49 C 337.00 77.01 354.01 85.48 367.98 100.71 C 374.76 108.11 379.77 116.00 383.47 125.12 C 391.81 145.65 393.96 166.02 393.99 224.82 L 394.00 258.15 L 399.44 265.10 C 412.12 281.30 417.53 302.07 413.07 317.44 C 411.12 324.14 404.14 331.36 398.00 333.02 C 395.52 333.68 393.01 334.36 392.41 334.52 C 391.81 334.68 390.78 338.09 390.12 342.09 C 385.78 368.40 365.70 392.33 339.15 402.82 C 326.09 407.98 315.17 409.77 286.50 411.46 C 263.38 412.82 194.49 413.31 164.50 412.34 Z M 297.04 402.52 C 325.33 400.39 338.90 396.08 354.06 384.44 C 370.70 371.67 382.00 351.39 382.00 334.32 C 382.00 330.49 381.43 329.11 378.50 325.87 C 372.25 318.95 374.80 315.91 382.50 321.10 C 388.88 325.41 395.34 326.11 399.38 322.93 C 405.68 317.95 407.57 307.31 404.49 294.23 C 402.36 285.21 395.14 271.79 388.08 263.75 L 385.23 260.50 L 384.71 211.50 C 384.24 167.81 383.96 161.31 382.14 151.50 C 378.08 129.69 371.71 116.57 359.01 103.89 C 351.87 96.76 348.77 94.48 340.94 90.64 C 330.07 85.30 316.45 81.44 304.99 80.44 L 297.02 79.74 L 290.05 86.31 C 280.95 94.90 265.00 103.80 265.00 100.30 C 265.00 99.91 270.82 93.71 277.94 86.52 C 287.38 76.99 291.57 71.97 293.43 67.98 C 297.73 58.74 296.32 50.84 289.73 47.29 C 284.73 44.60 274.16 45.01 265.21 48.26 C 257.33 51.12 242.08 59.06 233.89 64.57 C 228.69 68.07 224.98 68.99 225.03 66.75 C 225.04 66.06 227.18 62.94 229.78 59.82 C 240.16 47.33 246.48 33.79 245.79 25.49 C 244.00 3.89 213.20 5.28 182.31 28.34 C 159.87 45.11 146.72 63.87 138.41 91.00 C 135.84 99.38 134.82 101.50 133.35 101.50 C 131.71 101.50 131.50 100.63 131.53 94.00 C 131.54 89.88 131.77 85.15 132.03 83.50 L 132.50 80.50 L 124.00 80.76 C 96.51 81.60 66.41 95.00 53.21 112.28 C 34.25 137.10 30.01 157.65 30.00 224.78 L 30.00 260.06 L 26.01 265.11 C 20.94 271.52 14.54 284.48 11.98 293.50 C 8.65 305.27 9.72 316.72 14.68 322.19 C 18.52 326.44 26.23 325.15 34.08 318.94 C 42.00 312.67 44.77 317.62 37.48 325.02 L 32.78 329.79 L 34.40 338.15 C 35.54 343.95 37.75 350.01 41.66 358.00 C 46.58 368.04 48.32 370.51 55.40 377.50 C 72.44 394.32 87.76 399.88 123.00 402.00 C 148.00 403.51 151.08 403.57 217.50 403.80 C 262.53 403.95 282.38 403.63 297.04 402.52 Z M 201.07 362.27 C 199.38 360.22 198.00 358.31 198.00 358.02 C 198.00 357.88 196.62 357.80 194.38 357.80 C 195.85 357.70 196.73 357.57 196.88 357.44 C 197.09 357.24 194.33 352.67 190.76 347.29 C 169.15 314.71 168.31 312.05 177.23 304.09 L 179.07 302.44 C 178.74 303.10 180.90 302.68 185.28 301.21 C 191.64 299.07 194.34 298.78 208.00 298.73 C 221.55 298.68 224.25 298.94 229.47 300.86 C 232.76 302.06 234.90 302.50 234.22 301.82 C 234.17 301.77 234.12 301.69 234.08 301.59 L 237.25 303.72 C 242.36 307.15 244.42 310.96 243.58 315.42 C 243.24 317.22 237.18 327.41 230.11 338.09 C 223.04 348.77 217.45 357.84 217.69 358.25 C 217.78 358.41 218.03 358.54 218.56 358.64 C 216.83 358.65 215.62 359.52 213.24 362.15 C 208.59 367.31 205.25 367.34 201.07 362.27 Z M 80.29 263.74 C 80.23 247.49 80.74 232.72 81.94 227.50 C 80.97 231.71 80.36 247.45 80.29 263.74 Z M 133.18 356.70 C 128.66 356.33 124.94 355.90 122.52 355.44 C 118.35 354.64 114.59 353.65 111.19 352.42 C 117.06 354.44 124.24 355.81 133.18 356.70 Z M 83.98 320.14 C 83.78 319.44 83.59 318.73 83.40 318.00 C 82.77 315.53 82.22 311.05 81.76 305.34 C 82.32 311.38 83.00 316.08 83.98 320.14 Z M 233.02 285.08 C 232.85 265.39 234.06 234.71 235.85 228.73 C 234.38 233.65 233.05 258.17 233.02 280.68 L 233.02 285.08 Z M 310.76 349.35 C 306.10 352.55 302.00 354.43 294.33 355.67 C 301.85 354.42 306.14 352.52 310.76 349.35 Z M 161.61 358.08 C 167.20 358.18 172.86 358.21 177.96 358.19 C 172.89 358.25 167.28 358.21 161.61 358.08 Z M 89.87 334.88 C 90.04 335.19 90.22 335.50 90.40 335.80 C 89.76 334.75 89.16 333.64 88.58 332.49 C 88.99 333.28 89.42 334.07 89.87 334.88 Z M 180.28 268.92 C 180.26 245.91 180.14 238.54 179.16 232.29 C 180.14 238.53 180.26 245.88 180.28 268.72 C 180.28 268.79 180.28 268.86 180.28 268.92 Z';
const BIRD_WHITE_D =
    'M 152.16 357.86 C 113.84 356.65 98.96 351.16 89.87 334.88 C 83.92 324.23 82.20 316.23 80.88 293.00 C 79.73 272.59 80.34 234.42 81.94 227.50 C 83.95 218.79 84.79 216.28 87.58 210.59 C 95.48 194.48 110.50 186.00 131.11 186.00 C 156.60 186.00 171.89 199.34 178.12 227.00 C 180.06 235.63 180.26 239.47 180.28 268.92 L 180.29 301.35 L 177.23 304.09 C 168.31 312.05 169.15 314.71 190.76 347.29 C 194.33 352.67 197.09 357.24 196.88 357.44 C 196.04 358.23 171.31 358.46 152.16 357.86 Z M 217.69 358.25 C 217.45 357.84 223.04 348.77 230.11 338.09 C 237.18 327.41 243.24 317.22 243.58 315.42 C 244.42 310.96 242.36 307.15 237.25 303.72 L 233.00 300.87 L 233.02 280.68 C 233.05 258.17 234.38 233.65 235.85 228.73 C 236.38 226.95 237.60 222.80 238.57 219.50 C 245.01 197.41 260.11 186.05 283.00 186.05 C 304.53 186.05 321.24 197.48 328.24 217.00 C 332.78 229.65 333.21 235.05 332.73 273.22 C 332.29 308.10 332.18 309.87 329.74 319.08 C 325.54 334.94 320.85 342.43 310.76 349.35 C 301.70 355.57 293.92 356.91 260.50 357.99 C 224.61 359.16 218.23 359.20 217.69 358.25 Z';
const BIRD_BEAK_D =
    'M 201.07 362.27 C 199.38 360.22 198.00 358.31 198.00 358.02 C 198.00 357.88 196.62 357.80 194.38 357.80 C 195.85 357.70 196.73 357.57 196.88 357.44 C 197.09 357.24 194.33 352.67 190.76 347.29 C 169.15 314.71 168.31 312.05 177.23 304.09 L 179.07 302.44 C 178.74 303.10 180.90 302.68 185.28 301.21 C 191.64 299.07 194.34 298.78 208.00 298.73 C 221.55 298.68 224.25 298.94 229.47 300.86 C 232.76 302.06 234.90 302.50 234.22 301.82 C 234.17 301.77 234.12 301.69 234.08 301.59 L 237.25 303.72 C 242.36 307.15 244.42 310.96 243.58 315.42 C 243.24 317.22 237.18 327.41 230.11 338.09 C 223.04 348.77 217.45 357.84 217.69 358.25 C 217.78 358.41 218.03 358.54 218.56 358.64 C 216.83 358.65 215.62 359.52 213.24 362.15 C 208.59 367.31 205.25 367.34 201.07 362.27 Z';
const BIRD_WARP = {
    back: buildWarpLayers(BIRD_T, [
        { d: BIRD_BLACK_D, fill: 'rgb(4,5,7)', fillRule: 'evenodd' },
        { d: BIRD_BLUE_D, fill: 'rgb(2,101,227)', fillRule: 'evenodd' },
        { d: BIRD_WHITE_D, fill: 'rgb(246,248,251)', fillRule: 'evenodd' },
    ]),
    front: buildWarpLayers(BIRD_T, [{ d: BIRD_BEAK_D, fill: 'rgb(4,5,7)' }]),
};

// Robot v3 (Fable export): teal shell, white screen (mouth hole kept — the
// mouth is front-layered so wandering eyes pass behind it), eyes clip to the
// screen.
const ROBOT_T2 =
    'translate(-29.544 -33.338) scale(0.95858) matrix(1.142201 0 0 1.157643 280.899786 252.040983) matrix(1 0 0 1 -0.070838 -0.116044)  translate(-232.184102, -201.19429)';
const ROBOT_TEAL_D =
    'M 298.00 391.98 C 227.56 393.41 132.70 392.65 118.50 390.55 C 110.73 389.39 95.87 385.42 89.90 382.91 C 72.23 375.46 56.06 358.66 49.64 341.08 C 42.57 321.73 42.49 320.59 42.57 239.00 C 42.64 164.76 42.77 162.31 47.41 145.50 C 52.50 127.06 65.14 110.00 80.50 100.85 C 97.51 90.71 117.65 86.70 160.00 85.01 C 174.02 84.45 191.40 83.70 198.61 83.35 C 205.81 83.00 212.92 83.01 214.40 83.38 C 217.06 84.05 217.08 84.14 216.79 91.78 L 216.50 99.50 L 211.53 99.81 C 206.03 100.16 204.00 101.31 204.00 104.09 C 204.00 107.55 207.24 108.00 232.28 108.00 C 254.66 108.00 256.83 107.85 258.35 106.17 C 262.02 102.11 259.98 100.00 252.38 100.00 L 247.92 100.00 L 248.21 91.75 L 248.50 83.50 L 262.50 83.50 C 286.36 83.50 330.41 85.95 343.31 87.99 C 372.00 92.54 388.29 100.53 400.70 116.13 C 411.27 129.42 416.37 142.44 419.52 164.19 C 420.98 174.26 421.12 184.09 420.69 246.06 C 420.18 320.97 420.09 322.37 415.07 336.93 C 410.58 349.96 403.73 360.42 393.64 369.63 C 385.21 377.32 377.72 381.74 367.14 385.24 C 351.98 390.27 343.97 391.05 298.00 391.98 Z M 186.00 373.31 C 203.04 374.10 274.97 373.89 293.10 372.99 C 328.06 371.27 339.91 369.13 354.64 361.90 C 363.59 357.50 372.43 349.30 377.39 340.80 C 382.32 332.35 385.89 319.79 387.69 304.66 C 390.18 283.63 390.17 220.71 387.68 206.07 C 383.22 179.90 374.86 166.87 356.34 157.24 C 336.00 146.66 315.13 144.49 234.00 144.55 C 173.77 144.59 157.10 145.39 131.31 149.52 C 105.57 153.63 90.37 164.81 81.70 186.00 C 76.14 199.61 73.98 217.97 74.03 251.50 C 74.10 304.38 77.73 327.44 88.58 344.00 C 95.69 354.86 110.98 364.86 125.00 367.83 C 139.03 370.81 146.57 371.49 186.00 373.31 Z M 307.00 364.07 C 295.07 365.15 216.67 366.05 193.50 365.37 C 147.16 364.01 127.15 361.38 113.21 354.79 C 99.47 348.30 89.74 333.75 85.93 314.00 C 83.16 299.64 81.63 254.81 83.00 228.00 C 84.57 197.22 88.66 184.14 100.38 172.44 C 113.11 159.73 128.85 155.84 179.00 153.02 C 201.77 151.73 259.69 151.74 287.00 153.02 C 332.82 155.19 350.79 159.52 362.80 171.30 C 378.26 186.47 381.00 199.34 381.00 256.65 C 381.00 286.65 380.70 293.91 379.01 305.46 C 375.08 332.17 368.32 344.78 353.10 353.77 C 344.29 358.97 331.34 361.86 307.00 364.07 Z M 182.00 351.03 C 196.02 351.43 228.43 351.61 254.00 351.44 C 318.33 350.99 331.28 349.51 345.46 340.95 C 354.37 335.57 359.48 327.59 362.70 314.00 C 364.27 307.38 364.48 301.08 364.48 260.50 C 364.48 219.33 364.30 213.78 362.68 207.69 C 359.83 196.94 357.42 192.29 351.45 186.03 C 339.29 173.28 329.27 171.67 255.00 170.51 C 194.92 169.56 142.99 171.98 128.88 176.38 C 112.66 181.45 104.18 191.32 100.26 209.70 C 98.00 220.28 97.70 297.72 99.88 308.00 C 105.17 333.01 113.11 342.38 132.95 347.00 C 143.40 349.44 152.51 350.19 182.00 351.03 Z M 438.47 293.23 C 435.62 294.79 433.72 296.36 432.45 295.95 C 429.61 295.03 430.00 284.08 430.00 240.50 C 430.00 185.22 430.01 185.00 432.05 185.00 C 437.08 185.00 446.60 192.47 450.03 199.10 C 453.49 205.80 454.18 214.32 453.74 244.63 C 453.48 262.64 452.89 274.82 452.17 277.00 C 450.31 282.65 443.88 290.25 438.47 293.23 Z M 33.76 240.25 C 33.96 284.52 33.76 296.00 32.76 295.99 C 32.07 295.98 29.22 294.92 26.43 293.62 C 20.62 290.91 16.17 285.52 12.76 277.05 C 10.62 271.74 10.52 270.22 10.51 241.50 C 10.50 208.45 10.83 206.18 17.26 195.73 C 20.38 190.65 27.34 185.17 31.18 184.75 L 33.50 184.50 Z M 240.25 58.01 C 233.99 60.35 231.10 60.40 225.00 58.28 C 215.86 55.10 209.95 48.60 207.91 39.48 C 205.54 28.90 211.39 16.96 221.50 11.76 C 226.40 9.24 236.83 8.95 242.00 11.19 C 246.59 13.18 251.60 18.36 254.59 24.22 C 260.90 36.57 253.99 52.87 240.25 58.01 Z M 240.00 67.32 L 240.00 100.00 L 224.95 100.00 L 225.23 83.89 L 225.50 67.77 L 232.75 67.55 L 240.00 67.32 Z';
const ROBOT_BLACK_D =
    'M 138.50 401.01 C 92.38 398.40 64.96 385.08 48.04 357.06 C 40.76 345.02 37.72 335.48 35.13 316.54 L 33.50 304.59 L 29.72 303.80 C 24.42 302.70 20.49 300.49 15.25 295.67 C 9.46 290.34 6.14 285.05 3.84 277.51 C 2.25 272.27 2.01 267.69 2.01 241.64 C 2.00 209.98 2.60 204.62 7.19 195.63 C 11.66 186.86 24.89 176.05 31.19 176.01 C 33.62 176.00 33.95 175.09 35.07 165.30 C 36.95 148.96 39.94 138.02 45.61 126.73 C 52.41 113.18 64.60 100.24 77.89 92.44 C 86.48 87.40 103.63 81.68 116.50 79.56 C 127.85 77.69 155.91 76.06 189.75 75.31 L 216.00 74.72 L 215.94 69.11 C 215.88 63.70 215.73 63.39 211.69 60.47 C 192.21 46.39 196.21 14.58 218.76 4.25 C 231.99 -1.81 244.88 0.70 255.58 11.41 C 262.91 18.76 265.00 23.97 265.00 34.93 C 265.00 45.20 261.51 52.72 253.57 59.57 C 247.95 64.42 247.91 64.50 248.21 69.48 L 248.50 74.50 L 275.50 75.15 C 331.95 76.52 355.11 79.20 373.50 86.50 C 405.76 99.31 423.68 124.97 428.06 164.65 C 428.65 170.07 429.45 174.75 429.82 175.06 C 430.19 175.37 433.08 176.41 436.23 177.36 C 447.18 180.67 456.39 190.30 460.27 202.50 C 462.37 209.10 462.50 211.22 462.50 240.00 C 462.50 277.56 461.62 282.18 452.50 292.76 C 448.00 297.98 442.19 301.48 434.98 303.32 L 429.50 304.72 L 428.23 315.61 C 425.28 341.04 417.45 358.70 402.56 373.53 C 387.26 388.76 367.14 396.83 336.50 400.04 C 323.34 401.41 159.76 402.22 138.50 401.01 Z M 298.00 391.98 C 343.97 391.05 351.98 390.27 367.14 385.24 C 377.72 381.74 385.21 377.32 393.64 369.63 C 403.73 360.42 410.58 349.96 415.07 336.93 C 420.09 322.37 420.18 320.97 420.69 246.06 C 421.12 184.09 420.98 174.26 419.52 164.19 C 416.37 142.44 411.27 129.42 400.70 116.13 C 388.29 100.53 372.00 92.54 343.31 87.99 C 330.41 85.95 286.36 83.50 262.50 83.50 L 248.50 83.50 L 248.21 91.75 L 247.92 100.00 L 252.38 100.00 C 259.98 100.00 262.02 102.11 258.35 106.17 C 256.83 107.85 254.66 108.00 232.28 108.00 C 207.24 108.00 204.00 107.55 204.00 104.09 C 204.00 101.31 206.03 100.16 211.53 99.81 L 216.50 99.50 L 216.79 91.78 C 217.08 84.14 217.06 84.05 214.40 83.38 C 212.92 83.01 205.81 83.00 198.61 83.35 C 191.40 83.70 174.02 84.45 160.00 85.01 C 117.65 86.70 97.51 90.71 80.50 100.85 C 65.14 110.00 52.50 127.06 47.41 145.50 C 42.77 162.31 42.64 164.76 42.57 239.00 C 42.49 320.59 42.57 321.73 49.64 341.08 C 56.06 358.66 72.23 375.46 89.90 382.91 C 95.87 385.42 110.73 389.39 118.50 390.55 C 132.70 392.65 227.56 393.41 298.00 391.98 Z M 186.00 373.31 C 146.57 371.49 139.03 370.81 125.00 367.83 C 110.98 364.86 95.69 354.86 88.58 344.00 C 77.73 327.44 74.10 304.38 74.03 251.50 C 73.98 217.97 76.14 199.61 81.70 186.00 C 90.37 164.81 105.57 153.63 131.31 149.52 C 157.10 145.39 173.77 144.59 234.00 144.55 C 315.13 144.49 336.00 146.66 356.34 157.24 C 374.86 166.87 383.22 179.90 387.68 206.07 C 390.17 220.71 390.18 283.63 387.69 304.66 C 385.89 319.79 382.32 332.35 377.39 340.80 C 372.43 349.30 363.59 357.50 354.64 361.90 C 339.91 369.13 328.06 371.27 293.10 372.99 C 274.97 373.89 203.04 374.10 186.00 373.31 Z M 307.00 364.07 C 331.34 361.86 344.29 358.97 353.10 353.77 C 368.32 344.78 375.08 332.17 379.01 305.46 C 380.70 293.91 381.00 286.65 381.00 256.65 C 381.00 199.34 378.26 186.47 362.80 171.30 C 350.79 159.52 332.82 155.19 287.00 153.02 C 259.69 151.74 201.77 151.73 179.00 153.02 C 128.85 155.84 113.11 159.73 100.38 172.44 C 88.66 184.14 84.57 197.22 83.00 228.00 C 81.63 254.81 83.16 299.64 85.93 314.00 C 89.74 333.75 99.47 348.30 113.21 354.79 C 127.15 361.38 147.16 364.01 193.50 365.37 C 216.67 366.05 295.07 365.15 307.00 364.07 Z M 438.47 293.23 C 443.88 290.25 450.31 282.65 452.17 277.00 C 452.89 274.82 453.48 262.64 453.74 244.63 C 454.18 214.32 453.49 205.80 450.03 199.10 C 446.60 192.47 437.08 185.00 432.05 185.00 C 430.01 185.00 430.00 185.22 430.00 240.50 C 430.00 284.08 429.61 295.03 432.45 295.95 C 433.72 296.36 435.62 294.79 438.47 293.23 Z M 33.76 240.25 L 33.50 184.50 L 31.18 184.75 C 27.34 185.17 20.38 190.65 17.26 195.73 C 10.83 206.18 10.50 208.45 10.51 241.50 C 10.52 270.22 10.62 271.74 12.76 277.05 C 16.17 285.52 20.62 290.91 26.43 293.62 C 29.22 294.92 32.07 295.98 32.76 295.99 C 33.76 296.00 33.96 284.52 33.76 240.25 Z M 240.25 58.01 C 253.99 52.87 260.90 36.57 254.59 24.22 C 251.60 18.36 246.59 13.18 242.00 11.19 C 236.83 8.95 226.40 9.24 221.50 11.76 C 211.39 16.96 205.54 28.90 207.91 39.48 C 209.95 48.60 215.86 55.10 225.00 58.28 C 231.10 60.40 233.99 60.35 240.25 58.01 Z M 241.30 318.31 C 231.98 321.36 221.86 319.46 214.08 313.19 C 204.75 305.68 203.11 293.17 211.59 294.18 C 213.82 294.44 214.52 295.26 215.58 298.87 C 219.23 311.30 235.34 315.59 244.39 306.54 C 246.13 304.80 247.99 301.61 248.53 299.44 C 249.42 295.84 249.81 295.47 253.17 295.19 C 256.11 294.95 256.96 295.28 257.47 296.90 C 259.58 303.56 250.80 315.20 241.30 318.31 Z M 240.00 67.32 L 232.75 67.55 L 225.50 67.77 L 225.23 83.89 L 224.95 100.00 L 240.00 100.00 L 240.00 67.32 Z';
const ROBOT_WHITE_D =
    'M 182.00 351.03 C 152.51 350.19 143.40 349.44 132.95 347.00 C 113.11 342.38 105.17 333.01 99.88 308.00 C 97.70 297.72 98.00 220.28 100.26 209.70 C 104.18 191.32 112.66 181.45 128.88 176.38 C 142.99 171.98 194.92 169.56 255.00 170.51 C 329.27 171.67 339.29 173.28 351.45 186.03 C 357.42 192.29 359.83 196.94 362.68 207.69 C 364.30 213.78 364.48 219.33 364.48 260.50 C 364.48 301.08 364.27 307.38 362.70 314.00 C 359.48 327.59 354.37 335.57 345.46 340.95 C 331.28 349.51 318.33 350.99 254.00 351.44 C 228.43 351.61 196.02 351.43 182.00 351.03 Z M 241.30 318.31 C 250.80 315.20 259.58 303.56 257.47 296.90 C 256.96 295.28 256.11 294.95 253.17 295.19 C 249.81 295.47 249.42 295.84 248.53 299.44 C 247.99 301.61 246.13 304.80 244.39 306.54 C 235.34 315.59 219.23 311.30 215.58 298.87 C 214.52 295.26 213.82 294.44 211.59 294.18 C 203.11 293.17 204.75 305.68 214.08 313.19 C 221.86 319.46 231.98 321.36 241.30 318.31 Z';
const ROBOT_MOUTH_D =
    'M 241.30 318.31 C 231.98 321.36 221.86 319.46 214.08 313.19 C 204.75 305.68 203.11 293.17 211.59 294.18 C 213.82 294.44 214.52 295.26 215.58 298.87 C 219.23 311.30 235.34 315.59 244.39 306.54 C 246.13 304.80 247.99 301.61 248.53 299.44 C 249.42 295.84 249.81 295.47 253.17 295.19 C 256.11 294.95 256.96 295.28 257.47 296.90 C 259.58 303.56 250.80 315.20 241.30 318.31 Z';
const ROBOT_WARP = {
    back: buildWarpLayers(ROBOT_T2, [
        { d: ROBOT_BLACK_D, fill: 'rgb(2,5,6)', fillRule: 'evenodd' },
        { d: ROBOT_TEAL_D, fill: 'rgb(4,171,197)', fillRule: 'evenodd' },
        { d: ROBOT_WHITE_D, fill: 'rgb(252,252,252)', fillRule: 'evenodd' },
    ]),
    front: buildWarpLayers(ROBOT_T2, [{ d: ROBOT_MOUTH_D, fill: 'rgb(2,5,6)' }]),
};
// Alien v3 (Fable export): green head with antenna + pointy ears and three
// white eye sockets kept as art. Engine eyes clip to the sockets (bird-style);
// the forehead socket hosts the engine's third eye (see HeadSpec.thirdEye).
// Pupil + iris subpaths stripped — the engine draws all three eyes live.
const ALIEN_T =
    'translate(4.507 -76.856) scale(0.83891) matrix(0.585319 0 0 0.585359 279.170623 327.350877)  translate(-457.33631, -428.278441)';
const ALIEN_BLACK_D =
    'M 391.50 855.03 C 297.08 852.97 243.97 842.53 201.83 817.72 C 154.77 790.02 126.75 746.69 114.07 682.00 C 111.37 668.26 108.27 643.50 107.40 628.73 L 106.70 616.96 L 98.48 613.11 C 78.48 603.73 61.69 588.37 47.25 566.24 C 19.09 523.08 1.05 449.38 1.04 377.50 C 1.03 345.13 3.55 335.09 14.00 325.69 C 24.88 315.91 39.73 316.21 55.60 326.53 C 62.41 330.97 90.10 358.57 104.00 374.78 C 109.22 380.88 113.79 385.89 114.14 385.93 C 114.49 385.97 115.08 384.40 115.45 382.44 C 117.61 370.92 125.29 350.11 133.15 334.50 C 143.86 313.21 155.38 297.63 173.12 280.43 C 219.84 235.13 291.42 210.12 400.50 200.98 C 407.65 200.38 413.88 199.51 414.34 199.05 C 414.80 198.60 415.25 186.10 415.34 171.29 L 415.50 144.35 L 404.88 133.93 C 395.10 124.33 393.85 122.67 389.22 113.00 C 382.76 99.51 380.59 90.43 380.76 77.50 C 381.35 29.98 424.60 -6.34 470.16 2.41 C 510.14 10.09 537.26 46.35 532.87 86.27 C 531.64 97.42 529.66 103.86 524.18 114.50 C 520.38 121.89 517.72 125.35 509.31 133.80 C 501.30 141.86 498.93 144.88 498.39 147.71 C 497.69 151.47 498.63 186.99 499.65 195.16 L 500.23 199.81 L 508.37 200.46 C 531.78 202.33 558.70 205.51 576.85 208.54 C 670.86 224.25 733.00 258.60 770.53 315.60 C 781.45 332.17 794.36 362.02 798.08 379.25 C 798.76 382.41 799.81 384.97 800.41 384.94 C 801.01 384.91 805.55 380.13 810.50 374.32 C 823.86 358.64 849.55 332.96 857.27 327.54 C 866.56 321.03 872.86 318.75 881.65 318.70 C 887.45 318.67 889.85 319.18 894.36 321.39 C 910.51 329.29 915.55 349.05 913.01 394.50 C 908.99 466.29 892.08 528.32 865.71 568.00 C 851.50 589.37 836.50 603.01 816.67 612.60 L 807.00 617.27 L 806.99 623.89 C 806.97 638.63 802.48 672.49 797.84 692.92 C 789.09 731.51 773.32 763.08 751.12 786.47 C 709.40 830.41 654.17 849.21 553.00 853.92 C 522.88 855.32 433.23 855.93 391.50 855.03 Z M 389.50 826.94 C 467.62 829.14 555.83 827.22 598.00 822.40 C 672.41 813.91 716.81 791.47 745.68 747.78 C 765.52 717.77 775.77 678.74 778.99 621.00 C 780.28 597.97 780.28 457.30 778.99 440.00 C 774.27 376.51 757.83 336.40 722.37 301.90 C 691.15 271.53 650.96 252.97 588.50 240.09 C 564.17 235.07 522.78 229.88 495.50 228.43 C 483.39 227.79 478.09 226.57 476.55 224.08 C 475.22 221.92 473.91 211.46 472.51 191.63 C 470.04 156.64 470.87 132.42 474.77 125.81 C 475.68 124.26 479.24 121.19 482.66 118.97 C 497.74 109.22 505.68 93.64 504.76 75.61 C 504.20 64.55 501.68 57.44 495.34 48.99 C 486.83 37.68 474.77 31.20 460.50 30.27 C 440.65 28.98 423.64 38.84 414.75 56.78 L 410.50 65.35 L 410.50 77.92 C 410.50 90.34 410.55 90.59 414.17 98.19 C 418.17 106.56 423.64 113.15 430.26 117.57 C 440.60 124.47 441.58 126.29 443.11 141.30 C 444.93 159.25 441.32 217.80 438.01 223.98 C 436.43 226.92 432.20 227.78 413.45 228.93 C 356.26 232.42 299.84 243.34 262.80 258.07 C 203.25 281.75 166.50 318.29 148.17 372.00 C 136.73 405.56 134.03 435.58 134.03 529.50 C 134.02 652.02 139.58 692.80 162.15 736.00 C 169.64 750.33 176.76 759.94 188.47 771.50 C 226.50 809.04 280.24 823.86 389.50 826.94 Z M 475.12 536.53 C 442.80 542.19 408.84 531.56 383.47 507.83 C 359.28 485.20 344.44 447.62 346.27 413.64 C 348.90 364.86 380.31 321.97 424.37 306.99 C 475.65 289.55 531.11 314.42 556.25 366.15 C 564.93 384.01 568.37 399.17 568.37 419.50 C 568.37 435.00 567.37 441.71 562.85 456.50 C 550.05 498.39 516.10 529.36 475.12 536.53 Z M 292.92 711.96 C 287.35 712.53 282.50 712.95 282.14 712.90 C 281.79 712.84 277.18 712.20 271.91 711.48 C 266.64 710.76 258.09 708.76 252.91 707.03 C 185.18 684.38 153.30 603.61 186.45 538.65 C 218.29 476.25 292.93 456.89 347.00 497.01 C 359.61 506.36 371.36 520.01 379.71 535.00 C 396.19 564.59 398.97 603.48 386.93 636.21 C 371.27 678.79 335.53 707.59 292.92 711.96 Z M 656.26 709.18 C 645.10 712.21 621.79 712.68 610.00 710.11 C 588.32 705.39 566.26 692.34 551.42 675.43 C 507.66 625.60 510.43 551.03 557.71 505.91 C 579.58 485.03 606.24 474.97 636.00 476.34 C 656.12 477.27 672.00 482.49 688.90 493.74 C 732.79 522.94 752.17 579.59 735.83 630.92 C 723.56 669.48 693.45 699.10 656.26 709.18 Z M 445.03 516.86 C 457.42 518.91 471.04 517.72 484.44 513.41 C 498.05 509.02 508.06 502.90 519.34 492.07 C 531.64 480.26 540.06 466.00 545.66 447.50 C 548.20 439.10 548.38 437.27 548.38 420.00 C 548.38 402.71 548.20 400.91 545.65 392.50 C 535.25 358.21 512.34 334.79 480.00 325.39 C 470.02 322.49 445.39 322.72 434.58 325.82 C 417.56 330.69 399.13 342.64 389.00 355.35 C 379.26 367.58 371.61 383.61 368.62 398.06 C 356.99 454.40 391.45 507.98 445.03 516.86 Z M 619.75 691.01 C 647.52 694.49 674.97 684.45 694.81 663.56 C 703.55 654.36 707.16 649.07 712.48 637.68 C 719.87 621.83 721.43 614.27 721.46 594.00 C 721.50 573.63 719.94 565.98 712.53 550.32 C 707.28 539.21 703.71 533.90 695.79 525.44 C 687.53 516.61 679.16 510.48 668.50 505.46 C 656.57 499.83 648.86 497.96 634.94 497.29 C 609.17 496.06 587.58 504.48 569.02 523.00 C 555.40 536.60 547.94 550.14 542.78 570.67 C 540.96 577.92 540.57 582.19 540.62 594.50 C 540.67 607.46 541.04 610.86 543.34 619.50 C 547.49 635.11 556.07 651.39 565.89 662.32 C 578.70 676.58 601.51 688.73 619.75 691.01 Z M 273.06 690.91 C 282.36 692.12 285.57 692.12 294.85 690.96 C 313.61 688.61 329.84 680.77 344.19 667.14 C 357.70 654.30 366.86 638.84 372.12 620.00 C 374.22 612.44 374.48 609.51 374.42 593.50 C 374.36 578.43 374.00 574.25 372.24 567.85 C 362.13 531.12 335.84 505.50 301.05 498.45 C 290.09 496.23 271.72 496.90 261.32 499.90 C 223.12 510.92 196.51 545.10 193.46 587.10 C 191.11 619.39 206.00 653.82 230.34 672.39 C 243.86 682.70 258.44 689.02 273.06 690.91 Z M 99.41 581.15 C 103.21 583.82 106.61 586.00 106.98 586.00 C 107.34 586.00 107.61 554.84 107.59 516.75 C 107.56 478.66 107.89 442.10 108.33 435.50 L 109.12 423.50 L 90.34 402.00 C 59.08 366.20 39.44 347.00 34.06 347.00 C 29.00 347.00 27.26 363.09 28.99 394.00 C 32.62 458.59 48.17 516.85 70.96 551.23 C 77.63 561.29 90.70 575.03 99.41 581.15 Z M 806.80 504.75 C 807.00 549.44 807.48 586.00 807.85 586.00 C 809.88 586.00 820.60 577.58 828.12 570.09 C 855.75 542.56 874.74 492.08 883.64 422.50 C 885.90 404.81 886.31 352.92 884.21 349.25 C 881.21 344.00 874.97 348.10 855.50 368.11 C 841.33 382.68 808.12 419.77 806.97 422.32 C 806.67 422.97 806.60 460.06 806.80 504.75 Z M 476.34 751.11 C 468.50 753.87 451.84 754.56 443.51 752.45 C 420.82 746.71 400.39 725.56 399.18 706.54 C 398.81 700.71 398.99 700.08 401.94 696.72 C 409.88 687.68 422.50 690.23 426.40 701.65 C 430.13 712.61 435.48 718.36 445.92 722.66 C 452.70 725.45 461.55 725.71 468.57 723.33 C 475.83 720.87 484.90 711.44 487.83 703.31 C 491.35 693.55 498.31 689.30 506.40 691.97 C 510.32 693.26 514.67 697.82 515.62 701.64 C 516.73 706.05 515.23 712.19 510.91 720.94 C 503.97 734.98 491.70 745.68 476.34 751.11 Z';
const ALIEN_EAR_D =
    'M 106.69 585.90 C 106.86 584.85 107.00 576.11 107.00 565.57 C 107.00 545.92 106.92 545.11 104.97 544.49 C 101.40 543.36 89.23 530.42 83.65 521.82 C 76.81 511.30 72.25 502.18 67.50 489.50 C 59.31 467.69 51.40 428.27 53.97 422.08 C 55.56 418.24 57.43 417.64 61.58 419.60 C 67.25 422.30 84.15 441.71 100.11 463.85 L 106.71 473.02 L 107.35 455.26 C 107.70 445.49 108.25 434.35 108.58 430.50 L 108.93 426.37 L 108.33 435.50 C 107.89 442.10 107.56 478.66 107.59 516.75 C 107.61 554.84 107.34 586.00 106.98 586.00 C 106.93 586.00 106.83 585.96 106.69 585.90 Z M 806.80 504.75 C 806.70 482.38 806.67 461.91 806.70 446.97 C 806.71 447.53 806.73 448.10 806.75 448.67 L 807.50 473.50 L 812.00 466.82 C 825.28 447.09 847.68 421.21 853.33 419.06 C 856.85 417.73 859.74 419.10 860.59 422.52 C 861.52 426.21 859.32 442.92 856.00 457.31 C 846.76 497.50 829.54 530.59 811.35 543.10 L 807.08 546.04 C 806.97 533.92 806.87 519.80 806.80 504.75 Z M 855.50 368.11 C 848.74 375.06 837.25 387.58 827.12 398.87 C 837.16 387.67 848.59 375.22 855.50 368.11 Z M 807.84 586.00 C 808.96 585.90 812.01 583.90 815.73 581.00 C 811.95 583.96 808.85 586.00 807.85 586.00 C 807.85 586.00 807.84 586.00 807.84 586.00 Z';
const ALIEN_GREEN_D =
    'M 389.50 826.94 C 280.24 823.86 226.50 809.04 188.47 771.50 C 176.76 759.94 169.64 750.33 162.15 736.00 C 139.58 692.80 134.02 652.02 134.03 529.50 C 134.03 435.58 136.73 405.56 148.17 372.00 C 166.50 318.29 203.25 281.75 262.80 258.07 C 299.84 243.34 356.26 232.42 413.45 228.93 C 432.20 227.78 436.43 226.92 438.01 223.98 C 441.32 217.80 444.93 159.25 443.11 141.30 C 441.58 126.29 440.60 124.47 430.26 117.57 C 423.64 113.15 418.17 106.56 414.17 98.19 C 410.55 90.59 410.50 90.34 410.50 77.92 L 410.50 65.35 L 414.75 56.78 C 423.64 38.84 440.65 28.98 460.50 30.27 C 474.77 31.20 486.83 37.68 495.34 48.99 C 501.68 57.44 504.20 64.55 504.76 75.61 C 505.68 93.64 497.74 109.22 482.66 118.97 C 479.24 121.19 475.68 124.26 474.77 125.81 C 470.87 132.42 470.04 156.64 472.51 191.63 C 473.91 211.46 475.22 221.92 476.55 224.08 C 478.09 226.57 483.39 227.79 495.50 228.43 C 522.78 229.88 564.17 235.07 588.50 240.09 C 650.96 252.97 691.15 271.53 722.37 301.90 C 757.83 336.40 774.27 376.51 778.99 440.00 C 780.28 457.30 780.28 597.97 778.99 621.00 C 775.77 678.74 765.52 717.77 745.68 747.78 C 716.81 791.47 672.41 813.91 598.00 822.40 C 555.83 827.22 467.62 829.14 389.50 826.94 Z M 475.12 536.53 C 516.10 529.36 550.05 498.39 562.85 456.50 C 567.37 441.71 568.37 435.00 568.37 419.50 C 568.37 399.17 564.93 384.01 556.25 366.15 C 531.11 314.42 475.65 289.55 424.37 306.99 C 380.31 321.97 348.90 364.86 346.27 413.64 C 344.44 447.62 359.28 485.20 383.47 507.83 C 408.84 531.56 442.80 542.19 475.12 536.53 Z M 292.92 711.96 C 335.53 707.59 371.27 678.79 386.93 636.21 C 398.97 603.48 396.19 564.59 379.71 535.00 C 371.36 520.01 359.61 506.36 347.00 497.01 C 292.93 456.89 218.29 476.25 186.45 538.65 C 153.30 603.61 185.18 684.38 252.91 707.03 C 258.09 708.76 266.64 710.76 271.91 711.48 C 277.18 712.20 281.79 712.84 282.14 712.90 C 282.50 712.95 287.35 712.53 292.92 711.96 Z M 656.26 709.18 C 693.45 699.10 723.56 669.48 735.83 630.92 C 752.17 579.59 732.79 522.94 688.90 493.74 C 672.00 482.49 656.12 477.27 636.00 476.34 C 606.24 474.97 579.58 485.03 557.71 505.91 C 510.43 551.03 507.66 625.60 551.42 675.43 C 566.26 692.34 588.32 705.39 610.00 710.11 C 621.79 712.68 645.10 712.21 656.26 709.18 Z M 807.00 566.05 L 807.00 546.10 L 811.35 543.10 C 829.54 530.59 846.76 497.50 856.00 457.31 C 859.32 442.92 861.52 426.21 860.59 422.52 C 859.74 419.10 856.85 417.73 853.33 419.06 C 847.68 421.21 825.28 447.09 812.00 466.82 L 807.50 473.50 L 806.75 448.67 C 806.33 435.01 806.33 423.23 806.75 422.49 C 808.53 419.30 841.77 382.23 855.50 368.11 C 874.97 348.10 881.21 344.00 884.21 349.25 C 886.31 352.92 885.90 404.81 883.64 422.50 C 874.74 492.08 855.75 542.56 828.12 570.09 C 820.46 577.72 809.87 586.00 807.76 586.00 C 807.34 586.00 807.00 577.02 807.00 566.05 Z M 99.41 581.15 C 90.70 575.03 77.63 561.29 70.96 551.23 C 48.17 516.85 32.62 458.59 28.99 394.00 C 27.26 363.09 29.00 347.00 34.06 347.00 C 39.43 347.00 58.96 366.08 90.37 402.00 L 109.17 423.50 L 108.58 430.50 C 108.25 434.35 107.70 445.49 107.35 455.26 L 106.71 473.02 L 100.11 463.85 C 84.15 441.71 67.25 422.30 61.58 419.60 C 57.43 417.64 55.56 418.24 53.97 422.08 C 51.40 428.27 59.31 467.69 67.50 489.50 C 72.25 502.18 76.81 511.30 83.65 521.82 C 89.23 530.42 101.40 543.36 104.97 544.49 C 106.92 545.11 107.00 545.92 107.00 565.57 C 107.00 576.81 106.85 586.00 106.66 586.00 C 106.47 586.00 103.21 583.82 99.41 581.15 Z M 476.34 751.11 C 491.70 745.68 503.97 734.98 510.91 720.94 C 515.23 712.19 516.73 706.05 515.62 701.64 C 514.67 697.82 510.32 693.26 506.40 691.97 C 498.31 689.30 491.35 693.55 487.83 703.31 C 484.90 711.44 475.83 720.87 468.57 723.33 C 461.55 725.71 452.70 725.45 445.92 722.66 C 435.48 718.36 430.13 712.61 426.40 701.65 C 422.50 690.23 409.88 687.68 401.94 696.72 C 398.99 700.08 398.81 700.71 399.18 706.54 C 400.39 725.56 420.82 746.71 443.51 752.45 C 451.84 754.56 468.50 753.87 476.34 751.11 Z';
const ALIEN_SOCKETS_D =
    'M 273.06 690.91 C 258.44 689.02 243.86 682.70 230.34 672.39 C 206.00 653.82 191.11 619.39 193.46 587.10 C 196.51 545.10 223.12 510.92 261.32 499.90 C 271.72 496.90 290.09 496.23 301.05 498.45 C 335.84 505.50 362.13 531.12 372.24 567.85 C 374.00 574.25 374.36 578.43 374.42 593.50 C 374.48 609.51 374.22 612.44 372.12 620.00 C 366.86 638.84 357.70 654.30 344.19 667.14 C 329.84 680.77 313.61 688.61 294.85 690.96 C 285.57 692.12 282.36 692.12 273.06 690.91 Z M 619.75 691.01 C 601.51 688.73 578.70 676.58 565.89 662.32 C 556.07 651.39 547.49 635.11 543.34 619.50 C 541.04 610.86 540.67 607.46 540.62 594.50 C 540.57 582.19 540.96 577.92 542.78 570.67 C 547.94 550.14 555.40 536.60 569.02 523.00 C 587.58 504.48 609.17 496.06 634.94 497.29 C 648.86 497.96 656.57 499.83 668.50 505.46 C 679.16 510.48 687.53 516.61 695.79 525.44 C 703.71 533.90 707.28 539.21 712.53 550.32 C 719.94 565.98 721.50 573.63 721.46 594.00 C 721.43 614.27 719.87 621.83 712.48 637.68 C 707.16 649.07 703.55 654.36 694.81 663.56 C 674.97 684.45 647.52 694.49 619.75 691.01 Z M 445.03 516.86 C 391.45 507.98 356.99 454.40 368.62 398.06 C 371.61 383.61 379.26 367.58 389.00 355.35 C 399.13 342.64 417.56 330.69 434.58 325.82 C 445.39 322.72 470.02 322.49 480.00 325.39 C 512.34 334.79 535.25 358.21 545.65 392.50 C 548.20 400.91 548.38 402.71 548.38 420.00 C 548.38 437.27 548.20 439.10 545.66 447.50 C 540.06 466.00 531.64 480.26 519.34 492.07 C 508.06 502.90 498.05 509.02 484.44 513.41 C 471.04 517.72 457.42 518.91 445.03 516.86 Z';
const ALIEN_WARP = {
    back: buildWarpLayers(ALIEN_T, [
        { d: ALIEN_BLACK_D, fill: 'rgb(2,4,3)' },
        { d: ALIEN_EAR_D, fill: 'rgb(109,148,31)' },
        { d: ALIEN_GREEN_D, fill: 'rgb(161,212,51)' },
        { d: ALIEN_SOCKETS_D, fill: 'rgb(251,251,251)' },
    ]),
    front: [],
};

/* ───────────────────────────────────────────────────────────
   THE FRAME CONTRACT — one standard, zero per-head tuning.
   Canvas: 480×480. Eyes ALWAYS render at EYE_FRAME below; every head's
   art is pre-fit to it. To author a new head:
     1. Import template-480.svg into Fable as a guide layer
        (dashed frame + the resting eyes at their exact standard spot).
     2. Draw the head around those eyes. Keep the frame rect in the export
        so the exported viewBox stays the full 480 square.
     3. Registration (v3 warp heads): strip the eye + highlight subpaths
        (the engine draws them live), compute a fit that lands the drawn eye
        centers on EYE_FRAME (see KNIGHT_T — "translate(..) scale(..)"
        prefixed onto the export transform), then register layers via
        buildWarpLayers. Optional: front layers for occluders that eyes
        should slide behind (beaks, mouths); clip: <back-layer index> to
        clip eyes to a face window.
   ─────────────────────────────────────────────────────────── */
const EYE_FRAME = { dx: -1.5, dy: 39.5, s: 0.7066 }; // v3, owl-derived
// Whole-head warp targets per emotion. sq: squash(-)/stretch(+); tl: tilt deg;
// dy: settle offset. Flags add procedural motion (sway/bounce/tremor/drift).
// Everything is spring-lerped; a lagged "flex" layer makes the crown whip
// slightly behind the base — jelly warp from transforms alone, no path morphing.
const HEAD_POSE: Record<Emotion, HeadPoseDef> = {
    default: { sq: 0, tl: 0, dy: 0 },
    idle: { sq: 0, tl: 0, dy: 0 },
    happy: { sq: 0.045, tl: 0, dy: -4 },
    laughing: { sq: 0.02, tl: 0, dy: 0, bounce: 1 },
    tired: { sq: -0.055, tl: 2.5, dy: 7 },
    angry: { sq: -0.06, tl: -2, dy: 3 },
    confused: { sq: 0.005, tl: -4, dy: 0, sway: 1 },
    curious: { sq: 0.025, tl: -6, dy: -3 },
    thinking: { sq: 0.01, tl: 3.5, dy: -2, drift: 1 },
    sweat: { sq: -0.02, tl: 0, dy: 2, tremor: 1 },
    blink: { sq: 0, tl: 0, dy: 0 },
    closed: { sq: -0.03, tl: 0, dy: 5 },
};

const HEADS = {
    none: (_dark: boolean) => ({
        back: [],
        front: [],
        eyeColor: DARKEYE,
        slot: { dx: 0, dy: 0, s: 1 },
    }),

    // ── Owl: style v3 — colored art, white face mask, engine eyes on EYE_FRAME
    owl: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: OWL_WARP, // non-uniform warp: bend + squash-bulge on real geometry
        eyeColor: '#070708',
        hlColor: '#fcfcfd',
    }),

    // ── Robot: style v3 — teal shell, engine eyes clipped to the white screen,
    //     mouth front-layered so wandering eyes pass behind it
    robot: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: ROBOT_WARP,
        clip: 2, // white screen layer
        eyeColor: '#020506',
        hlColor: '#fcfcfc',
    }),
    // ── Bird: style v3 — blue body, twin eye patches, beak front occluder,
    //     eyes clipped to the patches
    bird: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: BIRD_WARP,
        clip: 2, // white patches layer
        eyeColor: '#040507',
        hlColor: '#f6f8fb',
    }),

    // ── Alien: style v3 — green head, engine eyes clipped to the three white
    //     sockets, plus a live third eye in the forehead socket. The sockets
    //     are round, so the eyes trade the standard tall capsule for a wide
    //     round pose that leaves socket white showing all around.
    alien: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: ALIEN_WARP,
        clip: 3, // white sockets layer
        eyeColor: '#020403',
        eyeScale: { w: 1.05, h: 0.62 },
        hlColor: '#fbfbfb',
        thirdEye: { dx: -2.9, dy: -120.9 },
    }),

    // ── Knight: style v3 — warped helm + plume, engine eyes in the visor
    knight: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: KNIGHT_WARP,
        eyeColor: '#0c0c0c',
        hlColor: '#fefefe',
    }),
} satisfies Record<string, (dark: boolean) => HeadSpec>;
export type HeadName = keyof typeof HEADS;
export const HEAD_KINDS = Object.keys(HEADS) as HeadName[];

/* ───────────────────────────────────────────────────────────
   AgentFace
   ─────────────────────────────────────────────────────────── */

export interface AgentFaceProps {
    animate?: boolean;
    blinking?: boolean;
    color?: string;
    dark?: boolean;
    drama?: number;
    emotion?: Emotion;
    guide?: boolean;
    head?: HeadName;
    /** Ink color for currentColor-backed face marks. Dark mode passes agent color. */
    ink?: string;
    intensity?: number;
    size?: number;
    slot?: Slot;
    speed?: number;
    style?: CSSProperties;
}

export function AgentFace({
    head = 'none',
    dark = false, // dark-background variant — pair with your app's web dark mode
    emotion = 'default',
    color = DARKEYE,
    size = 320,
    intensity = 1,
    speed = 1,
    blinking = true,
    animate = true, // false = render the emotion pose statically, no rAF loop.
    // Use for message-row avatars; animate only the "live" one.
    drama = 0.6, // exaggeration of head motion — pose lean, gaze chase,
    // sway/bounce energy. 0.6 = default (subtle), 1.4 = punchy, 2+ = cartoon.
    guide = false, // overlay the standard frame + resting eye placement (authoring aid)
    ink = INK,
    slot, // optional { dx, dy, s } override
    style,
}: AgentFaceProps) {
    const faceRef = useRef<SVGGElement | null>(null);
    const wBackRef = useRef<SVGGElement | null>(null),
        wFrontRef = useRef<SVGGElement | null>(null),
        clipRef = useRef<SVGPathElement | null>(null);
    const clipId = useRef(`afclip${Math.random().toString(36).slice(2, 8)}`).current;
    const lRef = useRef<SVGPathElement | null>(null),
        rRef = useRef<SVGPathElement | null>(null),
        cRef = useRef<SVGPathElement | null>(null),
        dropRef = useRef<SVGPathElement | null>(null);
    const pupilLRef = useRef<SVGEllipseElement | null>(null),
        pupilRRef = useRef<SVGEllipseElement | null>(null),
        pupilCRef = useRef<SVGEllipseElement | null>(null);
    const pr = useRef<{
        emotion: Emotion;
        intensity: number;
        speed: number;
        blinking: boolean;
        drama: number;
        sl?: Slot;
        warp?: WarpSet | null;
        clip?: number;
        third?: { dx: number; dy: number } | null;
        eyes?: { w: number; h: number } | null;
    }>({ emotion, intensity, speed, blinking, drama });
    pr.current = { emotion, intensity, speed, blinking, drama };

    const H: HeadSpec = (HEADS[head] || HEADS.none)(dark);
    const sl = slot || H.slot || EYE_FRAME;
    pr.current.sl = sl;
    pr.current.warp = H.warp || null;
    pr.current.clip = H.clip != null ? H.clip : -1;
    pr.current.third = H.thirdEye || null;
    pr.current.eyes = H.eyeScale || null;
    const thirdDx = H.thirdEye?.dx,
        thirdDy = H.thirdEye?.dy;
    const eyeScaleW = H.eyeScale?.w,
        eyeScaleH = H.eyeScale?.h;

    useEffect(() => {
        if (!animate) {
            return; // static pose handled by the effect below
        }
        const reduce =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cur = { L: D.slice(), R: D.slice() };
        const vel = { L: new Array(14).fill(0), R: new Array(14).fill(0) };
        const tgt: number[] = new Array(14);
        let lastEmotion: Emotion | null = null;
        let boing = 0,
            boingVel = 0; // impulse squash on emotion change
        // head-warp springs: fast set drives the pose, slow set exists only so the
        // fast-minus-slow difference can drive the transient "flex" layer
        const hpSq = { x: 0, v: 0 },
            hpTl = { x: 0, v: 0 },
            hpDy = { x: 0, v: 0 },
            hpDx = { x: 0, v: 0 },
            hpBd = { x: 0, v: 0 };
        const hpSqSlow = { x: 0, v: 0 },
            hpTlSlow = { x: 0, v: 0 },
            hpBdSlow = { x: 0, v: 0 };
        let blinkV = 0,
            blinkStart = -1,
            doubleQueued = false;
        let nextBlink = performance.now() + 900 + Math.random() * 1200;
        let raf = 0,
            last = performance.now();

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const P = pr.current;
            const dt = Math.min(0.033, (now - last) / 1000) || 0.016;
            last = now;
            const t = now / 1000;
            const emo: EmoDef = EMO[P.emotion] || EMO.default;
            const inten = Math.max(0, Math.min(1.25, P.intensity));
            const sp = Math.max(0.2, P.speed);
            const dr = Math.max(0, P.drama != null ? P.drama : 0.6);
            const k = 165 * sp * sp;
            const c = 2 * 0.72 * Math.sqrt(k);
            const changed = P.emotion !== lastEmotion;
            if (changed) {
                lastEmotion = P.emotion;
                boingVel -= 1.2 * sp * dr;
            }

            const bk = 130 * sp * sp,
                bc = 2 * 0.6 * Math.sqrt(bk); // one dip, quick settle — no ringing
            boingVel += (-bk * boing - bc * boingVel) * dt;
            boing += boingVel * dt;

            for (const side of ['L', 'R'] as const) {
                const cu = cur[side],
                    ve = vel[side],
                    em = emo[side];
                for (let i = 0; i < 14; i++) {
                    tgt[i] = D[i] + (em[i] - D[i]) * inten;
                    if (changed) {
                        ve[i] -= (tgt[i] - cu[i]) * 3.2;
                    }
                    ve[i] += (k * (tgt[i] - cu[i]) - c * ve[i]) * dt;
                    cu[i] += ve[i] * dt;
                }
            }

            const bp = BLINK[emo.blink];
            if (P.blinking && bp) {
                if (blinkStart < 0 && now >= nextBlink) {
                    blinkStart = now;
                }
                if (blinkStart >= 0) {
                    const e = now - blinkStart;
                    const { close, hold, open } = bp;
                    if (e < close) {
                        blinkV = easeInQuad(e / close);
                    } else if (e < close + hold) {
                        blinkV = 1;
                    } else if (e < close + hold + open) {
                        blinkV = 1 - easeOutBack((e - close - hold) / open);
                    } else {
                        blinkV = 0;
                        blinkStart = -1;
                        if (!doubleQueued && Math.random() < 0.22) {
                            nextBlink = now + 240;
                            doubleQueued = true;
                        } else {
                            doubleQueued = false;
                            nextBlink = now + (bp.min + Math.random() * bp.rand) * 1000;
                        }
                    }
                }
            } else if (blinkV !== 0) {
                blinkV = Math.max(0, blinkV - dt * 7);
                blinkStart = -1;
            }

            const breath = emo.breath || 1;

            // shared gaze signal — the eyes use it directly, the head warp CHASES it
            // through springs, so the whole face leans toward where the eyes look.
            let gzX = 0,
                gzY = 0;
            if (emo.ponder) {
                const ST = [
                    [42, -18],
                    [-36, -26],
                    [18, 12],
                    [-44, -4],
                    [38, -30],
                    [-10, 16],
                ];
                const iv = 1.6;
                const n = Math.floor(t / iv);
                const a = ST[n % 6],
                    b = ST[(n + 1) % 6];
                let e = Math.min(1, (t / iv - n) * 5);
                e = e * e * (3 - 2 * e);
                gzX = a[0] + (b[0] - a[0]) * e;
                gzY = a[1] + (b[1] - a[1]) * e;
            }
            if (emo.sway) {
                gzX += Math.sin(t * Math.PI * 2 * 0.5) * 3.3;
            }

            // HEAD WARP — rigid part (settle shift + tilt) stays a transform; the
            // DEFORMATION is a per-frame field W(x,y): quadratic bend (base planted,
            // crown swept toward gaze) + squash with mid-bulge (jelly volume). The
            // field warps head rings, eye outlines, and highlights together. Curve:
            // stiff near-critical springs — fast attack, exponential approach, ~2%
            // overshoot — with a lagging slow spring whose difference drives whip.
            let warpPt: ((x: number, y: number) => [number, number]) | null = null;
            {
                const pose = HEAD_POSE[P.emotion] || HEAD_POSE.default;
                const step = (
                    st: { x: number; v: number },
                    target: number,
                    kk: number,
                    dampR: number
                ) => {
                    const cc = 2 * dampR * Math.sqrt(kk);
                    st.v += (kk * (target - st.x) - cc * st.v) * dt;
                    st.x += st.v * dt;
                };
                const tlTarget = pose.tl * dr + gzX * 0.05 * dr;
                const dxTarget = gzX * 0.15 * dr;
                const dyTarget = pose.dy * dr + gzY * 0.3 * dr;
                const bdTarget = gzX * 0.85 * dr; // px of crown sweep
                step(hpSq, pose.sq * dr, 120 * sp * sp, 0.72);
                step(hpTl, tlTarget, 120 * sp * sp, 0.72);
                step(hpDy, dyTarget, 120 * sp * sp, 0.82);
                step(hpDx, dxTarget, 120 * sp * sp, 0.82);
                step(hpBd, bdTarget, 120 * sp * sp, 0.72);
                step(hpSqSlow, pose.sq * dr, 30 * sp * sp, 0.75);
                step(hpTlSlow, tlTarget, 30 * sp * sp, 0.75);
                step(hpBdSlow, bdTarget, 30 * sp * sp, 0.75);

                let sqTotal =
                    hpSq.x + Math.max(-0.3, Math.min(0.3, boing)) + (hpSq.x - hpSqSlow.x) * 0.45;
                let tiltTotal = hpTl.x + (hpTl.x - hpTlSlow.x) * 0.35;
                let dyTotal = hpDy.x;
                let dxTotal = hpDx.x;
                let bendTotal = hpBd.x + (hpBd.x - hpBdSlow.x) * 0.8; // crown lags, then settles
                if (reduce) {
                    sqTotal = hpSq.x;
                    bendTotal = hpBd.x;
                } else {
                    // breath: mostly a gentle base-pivot scale pulse (chest expansion),
                    // only a hint of translation — grounded, not floaty
                    dyTotal += Math.sin(t * Math.PI * 2 * 0.22) * 1.1 * breath;
                    sqTotal += Math.sin(t * Math.PI * 2 * 0.22 + 0.5) * 0.006 * breath;
                    if (pose.sway) {
                        tiltTotal += Math.sin(t * Math.PI * 2 * 0.5) * pose.sway * 3 * dr;
                    }
                    if (pose.drift) {
                        tiltTotal += Math.sin(t * Math.PI * 2 * 0.13) * 2 * dr;
                    }
                    if (pose.tremor) {
                        dxTotal += Math.sin(t * Math.PI * 2 * 9) * 2 * dr;
                    }
                    if (pose.bounce) {
                        const lbp = (t % 2.3) / 2.3;
                        const env = lbp < 0.62 ? Math.sqrt(Math.sin((Math.PI * lbp) / 0.62)) : 0;
                        const ha = Math.max(0, Math.sin(t * Math.PI * 2 * 3.3)) ** 2.2;
                        const kk2 = env * ha;
                        sqTotal += kk2 * 0.05 * dr;
                        dyTotal -= kk2 * 6 * dr;
                    }
                }
                sqTotal = Math.max(-0.3, Math.min(0.3, sqTotal));
                tiltTotal = Math.max(-20, Math.min(20, tiltTotal));
                dxTotal = Math.max(-43, Math.min(43, dxTotal));
                bendTotal = Math.max(-70, Math.min(70, bendTotal));

                const WD = pr.current.warp;
                if (faceRef.current) {
                    if (WD) {
                        faceRef.current.setAttribute(
                            'transform',
                            `translate(${dxTotal.toFixed(2)} ${dyTotal.toFixed(2)}) rotate(${tiltTotal.toFixed(3)} 240 396)`
                        );
                    } else {
                        faceRef.current.setAttribute(
                            'transform',
                            `translate(${dxTotal.toFixed(2)} ${(dyTotal - sqTotal * 12).toFixed(2)}) ` +
                                `rotate(${tiltTotal.toFixed(3)} 240 396) ` +
                                `translate(240 380) scale(${(1 - sqTotal * 0.55).toFixed(4)} ${(1 + sqTotal).toFixed(4)}) translate(-240 -380)`
                        );
                    }
                }
                if (WD) {
                    const bendK = bendTotal,
                        sqK = sqTotal;
                    const wp = (X: number, Y: number): [number, number] => {
                        const u = Math.max(0, Math.min(1.4, (424 - Y) / 380));
                        const bulge = Math.sin(Math.PI * Math.min(1, u));
                        return [
                            X + (X - 240) * -sqK * (0.35 + 0.75 * bulge ** 1.2) + bendK * u * u,
                            424 - (424 - Y) * (1 + sqK),
                        ];
                    };
                    warpPt = wp;
                    const warpRings = (rings: number[][]) => {
                        let d = '';
                        for (const r of rings) {
                            for (let i = 0; i < r.length; i += 2) {
                                const q = wp(r[i], r[i + 1]);
                                d += `${i === 0 ? 'M' : 'L'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
                            }
                            d += 'Z';
                        }
                        return d;
                    };
                    const clipIdx = pr.current.clip != null ? pr.current.clip : -1;
                    if (wBackRef.current) {
                        const ch = wBackRef.current.children;
                        for (let i = 0; i < WD.back.length && i < ch.length; i++) {
                            const dStr = warpRings(WD.back[i].rings);
                            ch[i].setAttribute('d', dStr);
                            if (i === clipIdx && clipRef.current) {
                                clipRef.current.setAttribute('d', dStr);
                            }
                        }
                    }
                    if (wFrontRef.current) {
                        const ch = wFrontRef.current.children;
                        for (let i = 0; i < WD.front.length && i < ch.length; i++) {
                            ch[i].setAttribute('d', warpRings(WD.front[i].rings));
                        }
                    }
                }
            }

            const resolve = (side: 'L' | 'R') => {
                const p = cur[side].slice();
                // NOTE: per-eye boing removed — the face group owns squash/stretch
                p[1] += Math.sin(t * Math.PI * 2 * 0.22) * 1.0 * breath;
                p[3] += Math.sin(t * Math.PI * 2 * 0.22 + 0.6) * 0.9 * breath;
                if (emo.bounce) {
                    const lbp = (t % 2.3) / 2.3;
                    const env = lbp < 0.62 ? Math.sqrt(Math.sin((Math.PI * lbp) / 0.62)) : 0;
                    const ha = Math.max(0, Math.sin(t * Math.PI * 2 * 3.3)) ** 2.2;
                    const kk = env * ha;
                    p[1] -= kk * 15;
                    p[3] -= kk * 9;
                    p[2] += kk * 7;
                    p[11] -= kk * 12;
                    p[12] += Math.sin(t * Math.PI * 2 * 1.65) * env * 2.2;
                }
                if (emo.sway) {
                    p[0] += Math.sin(t * Math.PI * 2 * 0.5) * (side === 'R' ? 5 : 1.6);
                    if (side === 'R') {
                        p[12] += Math.sin(t * Math.PI * 2 * 0.5) * 2;
                    }
                }
                if (emo.ponder) {
                    p[0] += gzX;
                    p[1] += gzY;
                    p[12] += gzX * 0.07;
                    const s = Math.max(0.8, 1 - Math.hypot(gzX, gzY) * 0.0035);
                    p[2] *= s;
                    p[3] *= s;
                    p[4] *= s;
                    p[5] *= s;
                    p[6] *= s;
                    p[7] *= s;
                    p[3] += Math.sin(t * Math.PI * 2 * 1.1) * 5;
                }
                if (emo.tremor) {
                    p[0] += Math.sin(t * Math.PI * 2 * 9) * (side === 'R' ? 1.1 : -1.1);
                }
                if (blinkV !== 0) {
                    const v = blinkV,
                        vc = Math.max(0, v);
                    p[1] += vc * p[3] * 0.2;
                    p[3] += (Math.min(p[3], 34) - p[3]) * v;
                    p[8] *= 1 - vc;
                    p[9] *= 1 - vc;
                    p[10] *= 1 - vc;
                    p[11] *= 1 - vc;
                }
                return p;
            };

            const pL = resolve('L'),
                pR = resolve('R');
            const es = pr.current.eyes;
            if (es) {
                applyEyeScale(pL, es);
                applyEyeScale(pR, es);
            }
            const third = pr.current.third;
            let pC: number[] | null = null,
                cx3 = 240;
            if (third) {
                pC = pL.map((v, i) => (v + pR[i]) * 0.5);
                pC[1] += third.dy;
                cx3 = 240 + third.dx;
            }
            const SL = pr.current.sl || EYE_FRAME;
            if (warpPt) {
                const eL = applySlot(buildPathPts(pL, LX), SL);
                const eR = applySlot(buildPathPts(pR, RX), SL);
                for (let i = 0; i < eL.length; i += 2) {
                    const q = warpPt(eL[i], eL[i + 1]);
                    eL[i] = q[0];
                    eL[i + 1] = q[1];
                }
                for (let i = 0; i < eR.length; i += 2) {
                    const q = warpPt(eR[i], eR[i + 1]);
                    eR[i] = q[0];
                    eR[i + 1] = q[1];
                }
                if (lRef.current) {
                    lRef.current.setAttribute('d', ptsToD(eL));
                }
                if (rRef.current) {
                    rRef.current.setAttribute('d', ptsToD(eR));
                }
                if (pC && cRef.current) {
                    const eC = applySlot(buildPathPts(pC, cx3), SL);
                    for (let i = 0; i < eC.length; i += 2) {
                        const q = warpPt(eC[i], eC[i + 1]);
                        eC[i] = q[0];
                        eC[i + 1] = q[1];
                    }
                    cRef.current.setAttribute('d', ptsToD(eC));
                    setPupil(pupilCRef, pC, cx3, SL, warpPt);
                }
                setPupil(pupilLRef, pL, LX, SL, warpPt);
                setPupil(pupilRRef, pR, RX, SL, warpPt);
            } else {
                if (lRef.current) {
                    lRef.current.setAttribute('d', buildPath(pL, LX));
                }
                if (rRef.current) {
                    rRef.current.setAttribute('d', buildPath(pR, RX));
                }
                if (pC && cRef.current) {
                    cRef.current.setAttribute('d', buildPath(pC, cx3));
                    setPupil(pupilCRef, pC, cx3);
                }
                setPupil(pupilLRef, pL, LX);
                setPupil(pupilRRef, pR, RX);
            }

            // sweat drop (eye-local)
            const dropV = emo.drop ? 1 : 0;
            if (dropRef.current) {
                if (dropV && !reduce) {
                    const cyc = (t % 1.9) / 1.9;
                    let s = 1,
                        y = 92,
                        o = 0;
                    if (cyc < 0.18) {
                        const q = cyc / 0.18;
                        s = 0.35 + 0.65 * q;
                        o = q;
                    } else if (cyc < 0.62) {
                        const q = (cyc - 0.18) / 0.44;
                        y = 92 + 118 * q * q;
                        o = 1;
                    } else if (cyc < 0.78) {
                        const q = (cyc - 0.62) / 0.16;
                        y = 210 + 14 * q;
                        o = 1 - q;
                    } else {
                        o = 0;
                    }
                    if (warpPt) {
                        const SLd = pr.current.sl || EYE_FRAME;
                        const ax = 444 * SLd.s + 240 * (1 - SLd.s) + SLd.dx;
                        const ay = y * SLd.s + 240 * (1 - SLd.s) + SLd.dy;
                        const q = warpPt(ax, ay);
                        dropRef.current.setAttribute(
                            'transform',
                            `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)}) scale(${(s * 2.8 * SLd.s).toFixed(3)})`
                        );
                    } else {
                        dropRef.current.setAttribute(
                            'transform',
                            `translate(444 ${y.toFixed(1)}) scale(${(s * 2.8).toFixed(3)})`
                        );
                    }
                    dropRef.current.setAttribute('opacity', (o * 0.95).toFixed(3));
                } else {
                    dropRef.current.setAttribute('opacity', '0');
                }
            }
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [animate]);

    // Static pose: paints the exact emotion target once, no loop. Message-row
    // avatars cost nothing at rest; flipping animate back on springs to life.
    useEffect(() => {
        if (animate) {
            return;
        }
        const emo: EmoDef = EMO[emotion] || EMO.default;
        const inten = Math.max(0, Math.min(1.25, intensity));
        const pose = (side: 'L' | 'R') => {
            const p: number[] = new Array(14);
            for (let i = 0; i < 14; i++) {
                p[i] = D[i] + (emo[side][i] - D[i]) * inten;
            }
            return p;
        };
        const pL = pose('L'),
            pR = pose('R');
        if (eyeScaleW != null && eyeScaleH != null) {
            const es = { w: eyeScaleW, h: eyeScaleH };
            applyEyeScale(pL, es);
            applyEyeScale(pR, es);
        }
        let pC: number[] | null = null,
            cx3 = 240;
        if (thirdDx != null && thirdDy != null) {
            pC = pL.map((v, i) => (v + pR[i]) * 0.5);
            pC[1] += thirdDy;
            cx3 = 240 + thirdDx;
        }
        const WD = pr.current.warp,
            SL = pr.current.sl || EYE_FRAME;
        if (WD) {
            if (lRef.current) {
                lRef.current.setAttribute('d', ptsToD(applySlot(buildPathPts(pL, LX), SL)));
            }
            if (rRef.current) {
                rRef.current.setAttribute('d', ptsToD(applySlot(buildPathPts(pR, RX), SL)));
            }
            if (pC && cRef.current) {
                cRef.current.setAttribute('d', ptsToD(applySlot(buildPathPts(pC, cx3), SL)));
                setPupil(pupilCRef, pC, cx3, SL);
            }
            setPupil(pupilLRef, pL, LX, SL);
            setPupil(pupilRRef, pR, RX, SL);
            if (wBackRef.current) {
                const ch = wBackRef.current.children;
                for (let i = 0; i < WD.back.length && i < ch.length; i++) {
                    ch[i].setAttribute('d', WD.back[i].baseD);
                }
            }
            const ci = pr.current.clip != null ? pr.current.clip : -1;
            if (ci >= 0 && clipRef.current) {
                clipRef.current.setAttribute('d', WD.back[ci].baseD);
            }
            if (wFrontRef.current) {
                const ch = wFrontRef.current.children;
                for (let i = 0; i < WD.front.length && i < ch.length; i++) {
                    ch[i].setAttribute('d', WD.front[i].baseD);
                }
            }
        } else {
            if (lRef.current) {
                lRef.current.setAttribute('d', buildPath(pL, LX));
            }
            if (rRef.current) {
                rRef.current.setAttribute('d', buildPath(pR, RX));
            }
            if (pC && cRef.current) {
                cRef.current.setAttribute('d', buildPath(pC, cx3));
                setPupil(pupilCRef, pC, cx3);
            }
            setPupil(pupilLRef, pL, LX);
            setPupil(pupilRRef, pR, RX);
        }
        if (faceRef.current) {
            faceRef.current.setAttribute('transform', '');
        }
        if (dropRef.current) {
            dropRef.current.setAttribute('opacity', '0');
        }
    }, [animate, emotion, eyeScaleH, eyeScaleW, intensity, thirdDx, thirdDy]);

    const eyeColor = head === 'none' ? (dark ? LIGHTEYE : color) : H.eyeColor;
    const slotTf = `translate(${sl.dx} ${sl.dy}) translate(${CY} ${CY}) scale(${sl.s}) translate(${-CY} ${-CY})`;
    const pupilColor = H.hlColor || (eyeColor === DARKEYE || eyeColor === INK ? PAPER : INK);

    return (
        <svg
            aria-label={`${head} agent, ${emotion}`}
            height={size}
            style={{ color: ink, overflow: 'visible', ...style }}
            viewBox={`0 0 ${VB} ${VB}`}
            width={size}
        >
            <g ref={faceRef}>
                {H.warp ? (
                    <g>
                        {H.clip != null && (
                            <clipPath id={clipId}>
                                <path
                                    clipRule={H.warp.back[H.clip].fillRule}
                                    d={H.warp.back[H.clip].baseD}
                                    ref={clipRef}
                                />
                            </clipPath>
                        )}
                        <g ref={wBackRef}>
                            {H.warp.back.map((L) => (
                                <path
                                    d={L.baseD}
                                    fill={L.fill}
                                    fillRule={L.fillRule}
                                    key={L.baseD}
                                    stroke={L.stroke}
                                    strokeLinejoin={L.stroke ? 'round' : undefined}
                                    strokeWidth={L.strokeWidth}
                                />
                            ))}
                        </g>
                        <g clipPath={H.clip != null ? `url(#${clipId})` : undefined}>
                            <path fill={eyeColor} ref={lRef} />
                            <path fill={eyeColor} ref={rRef} />
                            {H.thirdEye && <path fill={eyeColor} ref={cRef} />}
                            <ellipse fill={pupilColor} opacity="0" ref={pupilLRef} />
                            <ellipse fill={pupilColor} opacity="0" ref={pupilRRef} />
                            {H.thirdEye && (
                                <ellipse fill={pupilColor} opacity="0" ref={pupilCRef} />
                            )}
                        </g>
                        <path d={DROP} fill="#5fb8f6" opacity="0" ref={dropRef} />
                        <g ref={wFrontRef}>
                            {H.warp.front.map((L) => (
                                <path
                                    d={L.baseD}
                                    fill={L.fill}
                                    fillRule={L.fillRule}
                                    key={L.baseD}
                                />
                            ))}
                        </g>
                    </g>
                ) : (
                    <g>
                        {H.back}
                        <g transform={slotTf}>
                            <path fill={eyeColor} ref={lRef} />
                            <path fill={eyeColor} ref={rRef} />
                            {H.thirdEye && <path fill={eyeColor} ref={cRef} />}
                            <ellipse fill={pupilColor} opacity="0" ref={pupilLRef} />
                            <ellipse fill={pupilColor} opacity="0" ref={pupilRRef} />
                            {H.thirdEye && (
                                <ellipse fill={pupilColor} opacity="0" ref={pupilCRef} />
                            )}
                            <path d={DROP} fill="#5fb8f6" opacity="0" ref={dropRef} />
                        </g>
                        {H.front}
                    </g>
                )}
            </g>
            {guide && (
                <g pointerEvents="none">
                    <rect
                        fill="none"
                        height={VB - 4}
                        opacity="0.8"
                        stroke="#e0457b"
                        strokeDasharray="12 9"
                        strokeWidth="3"
                        width={VB - 4}
                        x="2"
                        y="2"
                    />
                    <line
                        opacity="0.35"
                        stroke="#e0457b"
                        strokeWidth="1.5"
                        x1={VB / 2}
                        x2={VB / 2}
                        y1="0"
                        y2={VB}
                    />
                    <g opacity="0.85" transform={slotTf}>
                        <path
                            d={buildPath(D, LX)}
                            fill="none"
                            stroke="#e0457b"
                            strokeDasharray={`${18 / sl.s} ${13 / sl.s}`}
                            strokeWidth={7 / sl.s}
                        />
                        <path
                            d={buildPath(D, RX)}
                            fill="none"
                            stroke="#e0457b"
                            strokeDasharray={`${18 / sl.s} ${13 / sl.s}`}
                            strokeWidth={7 / sl.s}
                        />
                    </g>
                </g>
            )}
        </svg>
    );
}

export default AgentFace;
