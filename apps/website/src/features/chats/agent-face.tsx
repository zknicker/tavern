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
// Owl v5 (Fable export, outline-free): purple body, white face mask, black
// beak duplicated as a front occluder so eyes slide behind it during gaze
// wander. Drawn eye capsules + highlights stripped — the engine draws live
// eyes on EYE_FRAME; this art's eyes run slightly taller than the v3
// standard, hence the small eyeScale on the head spec.
const OWL_T =
    'translate(24.221 30.884) scale(1.2504) matrix(0.396269 0 0 0.396577 171.080473 168.864607)  translate(-433.228127, -426.851848)';
const OWL_PURPLE_D =
    'M 289.50 852.37 C 202.60 850.03 157.84 842.78 120.28 824.96 C 55.40 794.19 15.73 732.66 5.55 647.00 C 1.94 616.68 1.50 600.84 1.50 502.50 C 1.50 404.54 1.92 388.86 5.59 350.00 C 9.88 304.52 19.89 267.19 37.17 232.24 L 43.23 219.99 L 38.98 213.47 C 33.46 204.99 30.00 195.38 30.00 188.49 C 30.00 177.36 36.50 166.56 46.64 160.84 C 49.59 159.17 52.00 157.33 52.00 156.74 C 52.00 156.15 49.77 150.86 47.04 144.98 C 30.62 109.65 22.57 67.44 25.92 34.27 C 28.47 8.96 35.37 -0.16 50.90 1.26 C 60.95 2.18 75.11 9.22 111.50 31.37 C 149.08 54.25 161.70 61.49 168.00 63.82 C 177.54 67.34 186.40 67.12 210.00 62.75 C 279.64 49.87 348.78 44.02 431.50 44.02 C 515.58 44.02 583.44 49.61 656.06 62.52 C 680.02 66.78 690.05 67.05 699.20 63.68 C 702.67 62.41 714.95 55.58 726.50 48.52 C 780.86 15.27 800.29 4.47 810.27 1.95 C 821.59 -0.90 831.35 3.11 835.52 12.32 C 839.43 20.95 840.46 28.94 840.40 50.00 C 840.29 84.73 834.53 110.96 819.85 143.46 C 816.63 150.59 814.00 156.74 814.00 157.12 C 814.00 157.50 816.41 159.17 819.35 160.83 C 838.10 171.41 841.38 192.65 827.43 213.17 L 822.90 219.83 L 828.40 230.79 C 850.86 275.58 860.79 321.87 863.97 396.50 C 865.28 427.43 865.29 574.90 863.97 603.32 C 861.27 661.84 853.56 698.88 837.08 732.50 C 812.66 782.35 775.26 816.04 725.00 833.49 C 696.94 843.23 667.82 847.79 612.50 851.13 C 596.25 852.12 319.31 853.18 289.50 852.37 Z M 412.50 798.35 C 430.47 799.74 461.54 798.32 485.00 795.03 C 594.30 779.70 701.61 708.67 742.38 624.65 C 756.32 595.93 763.10 572.35 768.23 534.80 C 770.29 519.72 770.45 514.62 770.48 466.50 C 770.50 411.24 770.06 403.95 765.49 384.50 C 753.41 333.05 717.86 289.31 671.80 269.20 C 640.72 255.63 603.05 254.46 569.00 266.01 C 558.73 269.49 539.05 279.34 529.89 285.57 C 499.10 306.53 473.25 336.26 445.81 382.25 C 440.32 391.46 435.40 399.00 434.89 399.00 C 434.37 399.00 432.82 397.09 431.44 394.75 C 413.47 364.34 404.44 350.55 393.31 336.50 C 357.97 291.89 315.71 265.21 270.68 259.07 C 260.61 257.69 241.31 257.70 231.39 259.08 C 198.98 263.59 170.43 278.34 145.50 303.48 C 119.26 329.93 103.43 362.42 97.40 402.20 C 95.25 416.44 94.31 484.03 95.93 509.10 C 100.93 586.66 122.79 640.01 168.98 687.36 C 198.01 717.12 228.63 739.28 268.00 759.00 C 313.96 782.02 358.65 794.20 412.50 798.35 Z';
const OWL_FACE_D =
    'M 412.50 798.35 C 358.65 794.20 313.96 782.02 268.00 759.00 C 228.63 739.28 198.01 717.12 168.98 687.36 C 122.79 640.01 100.93 586.66 95.93 509.10 C 94.31 484.03 95.25 416.44 97.40 402.20 C 103.43 362.42 119.26 329.93 145.50 303.48 C 170.43 278.34 198.98 263.59 231.39 259.08 C 241.31 257.70 260.61 257.69 270.68 259.07 C 315.71 265.21 357.97 291.89 393.31 336.50 C 404.44 350.55 413.47 364.34 431.44 394.75 C 432.82 397.09 434.37 399.00 434.89 399.00 C 435.40 399.00 440.32 391.46 445.81 382.25 C 473.25 336.26 499.10 306.53 529.89 285.57 C 539.05 279.34 558.73 269.49 569.00 266.01 C 603.05 254.46 640.72 255.63 671.80 269.20 C 717.86 289.31 753.41 333.05 765.49 384.50 C 770.06 403.95 770.50 411.24 770.48 466.50 C 770.45 514.62 770.29 519.72 768.23 534.80 C 763.10 572.35 756.32 595.93 742.38 624.65 C 701.61 708.67 594.30 779.70 485.00 795.03 C 461.54 798.32 430.47 799.74 412.50 798.35 Z';
const OWL_BEAK_D =
    'M 437.46 709.58 C 435.59 710.36 433.71 710.96 433.28 710.92 C 429.11 710.50 424.04 705.36 416.57 694.00 C 384.23 644.79 369.42 621.75 366.64 616.30 C 363.44 610.04 364.38 605.39 370.92 595.29 C 380.63 580.27 420.91 527.94 426.14 523.53 C 429.37 520.82 435.45 520.10 439.03 522.02 C 440.88 523.00 451.60 535.89 461.48 549.00 C 497.99 597.42 501.60 602.19 501.96 607.20 C 502.00 607.78 502.00 608.36 502.00 609.02 C 502.00 614.07 500.58 617.13 492.25 630.00 C 490.29 633.03 486.81 638.42 484.50 642.00 C 482.20 645.58 471.44 661.92 460.59 678.33 C 444.03 703.36 440.31 708.39 437.46 709.58 Z';
// Warpable layers: flattened once at module load into canvas-space rings.
const OWL_WARP = {
    back: buildWarpLayers(OWL_T, [
        { d: OWL_PURPLE_D, fill: 'rgb(122,45,255)', fillRule: 'evenodd' },
        { d: OWL_FACE_D, fill: 'rgb(253,252,250)' },
    ]),
    front: buildWarpLayers(OWL_T, [{ d: OWL_BEAK_D, fill: 'rgb(11,11,11)' }]),
};

// Knight v4 (Fable export, outline-free): the export comes as back/front
// pairs — back adds a gray face-window backing the front omits. Decomposed
// here: plume + window backing render behind the eyes; the slit/rivet
// details, lower plate, and face plate (window + slit knockouts) render in
// front, so the eyes peer out of the window and the plate's lower edge
// occludes their bottoms — ~15% tucked behind the visor at rest (the head's
// slot sinks EYE_FRAME to the window). Export edge slivers stripped.
const KNIGHT_T =
    'translate(50.888 -12) scale(0.98) matrix(0.999999 0 0 0.99999 192.97107 239.447306)  translate(-194.028737, -240.380554)';
const KN_PLUME_D =
    'M 248.43 112.05 C 247.75 108.11 246.63 107.28 243.32 105.34 C 232.00 98.71 203.46 94.81 180.89 96.82 C 165.86 98.16 150.98 101.33 146.23 104.21 C 143.79 105.68 142.07 107.67 141.06 110.17 C 140.35 111.92 139.99 113.93 139.98 116.20 C 139.99 113.92 140.34 111.92 141.06 110.17 C 142.10 107.63 143.91 105.60 146.56 103.96 C 149.40 102.21 150.04 101.29 149.55 99.62 C 148.20 94.91 146.04 76.03 146.05 69.00 C 146.11 43.51 156.78 23.09 176.72 10.31 C 194.02 -0.78 217.07 -2.28 225.68 7.12 C 230.56 12.44 231.32 20.95 227.85 31.50 C 226.67 35.10 225.93 38.26 226.20 38.53 C 226.47 38.80 228.67 38.28 231.09 37.38 C 233.52 36.47 238.65 35.68 242.50 35.62 C 248.17 35.52 250.28 35.95 253.63 37.87 C 257.93 40.33 262.00 46.20 262.00 49.93 C 262.00 53.15 258.37 59.64 253.80 64.60 L 249.75 69.00 L 254.90 69.00 C 264.35 69.00 270.18 73.21 271.49 80.96 C 272.85 88.97 266.05 98.16 254.28 104.26 L 248.03 107.50 L 248.43 112.05 Z';
const KN_WINDOW_D =
    'M 237.02 382.97 C 221.57 384.14 169.91 384.11 153.47 382.92 C 130.53 381.26 93.01 374.96 75.50 369.83 C 65.41 366.87 54.13 360.72 48.27 354.98 L 43.19 350.00 L 42.45 340.25 C 41.44 326.87 42.57 302.36 44.57 294.22 C 51.47 266.12 68.35 255.52 116.50 249.07 C 170.46 241.84 234.84 242.80 287.50 251.61 C 323.39 257.61 337.63 268.16 344.72 294.00 C 346.21 299.43 346.50 304.60 346.50 325.35 L 346.50 350.20 L 340.48 355.85 C 330.76 364.97 321.03 369.27 299.50 373.96 C 284.93 377.13 252.61 381.79 237.02 382.97 Z';
const KN_SLITS_D =
    'M 200.91 224.54 C 194.79 227.71 186.35 225.52 183.51 220.02 C 181.35 215.84 181.27 155.68 183.42 150.53 C 187.04 141.87 201.29 141.76 205.37 150.36 C 206.77 153.32 207.00 158.20 207.00 185.00 C 207.00 219.34 206.66 221.58 200.91 224.54 Z M 249.83 226.30 C 244.49 229.64 238.14 228.90 233.94 224.44 C 231.53 221.88 231.50 221.58 231.18 200.17 C 230.83 176.55 231.43 172.38 235.66 169.05 C 238.86 166.54 246.51 166.27 249.78 168.56 C 254.53 171.89 255.00 174.45 255.00 196.98 C 255.00 219.70 254.33 223.49 249.83 226.30 Z M 152.58 226.34 C 147.50 229.63 141.09 228.85 136.94 224.44 C 134.52 221.87 134.50 221.64 134.20 199.26 C 133.98 183.44 134.25 175.82 135.08 173.80 C 136.92 169.37 140.62 167.00 145.70 167.00 C 151.24 167.00 153.50 168.19 155.74 172.28 C 157.27 175.08 157.50 178.39 157.50 197.60 C 157.50 221.01 157.09 223.42 152.58 226.34 Z M 294.13 232.43 C 289.18 235.00 285.28 234.13 281.00 229.53 C 278.54 226.88 278.50 226.57 278.50 210.17 C 278.50 194.39 278.62 193.33 280.79 190.29 C 285.03 184.35 293.51 184.66 297.72 190.91 C 299.84 194.06 300.00 195.34 300.00 209.18 C 300.00 225.99 299.01 229.91 294.13 232.43 Z M 105.03 232.48 C 103.42 233.32 101.29 234.00 100.30 234.00 C 97.81 233.99 92.35 230.52 91.06 228.12 C 90.44 226.95 90.00 219.48 90.00 209.97 C 90.00 196.69 90.30 193.31 91.67 190.99 C 95.03 185.30 102.12 184.35 107.23 188.92 L 110.50 191.83 L 110.82 208.34 C 111.17 226.72 110.46 229.68 105.03 232.48 Z M 199.30 458.80 C 193.75 461.65 187.56 460.30 184.46 455.58 C 183.18 453.62 182.94 451.91 183.46 448.45 L 184.14 443.89 L 191.32 444.59 C 200.63 445.48 200.30 445.43 201.75 446.34 C 204.42 448.00 202.63 457.09 199.30 458.80 Z M 262.37 454.93 C 259.56 457.13 255.09 457.51 251.03 455.89 C 247.76 454.58 247.03 453.27 247.02 448.62 L 247.00 444.74 L 253.25 445.45 C 264.42 446.71 265.00 446.94 265.00 450.05 C 265.00 451.89 264.09 453.57 262.37 454.93 Z M 138.12 454.39 C 136.13 456.19 130.96 457.12 127.26 456.34 C 122.42 455.31 120.08 447.75 124.25 446.63 C 127.61 445.73 132.05 445.89 136.25 447.05 C 139.19 447.87 140.00 448.59 140.00 450.39 C 140.00 451.66 139.16 453.45 138.12 454.39 Z';
const KN_PLATE_D =
    'M 141.50 478.92 C 124.04 477.93 106.55 476.28 94.08 474.43 C 82.74 472.75 79.93 472.36 79.23 470.93 C 78.99 470.43 79.00 469.81 79.00 468.96 C 79.00 465.13 77.21 464.31 65.88 462.94 C 60.72 462.32 56.33 461.64 56.12 461.44 C 55.91 461.24 54.84 461.55 53.74 462.14 C 50.20 464.03 39.80 457.88 29.93 448.04 C 17.53 435.70 10.79 421.83 6.01 398.82 C 1.86 378.87 -0.26 348.88 1.94 341.21 C 2.46 339.41 4.03 336.56 5.44 334.89 L 7.51 332.43 L 7.50 332.85 L 12.17 332.29 C 18.91 331.50 22.61 334.09 27.01 342.68 C 30.87 350.21 39.80 361.92 45.09 366.38 C 46.96 367.96 54.19 372.99 61.14 377.56 C 72.99 385.35 73.97 386.24 76.64 391.69 C 79.49 397.48 79.50 397.59 80.06 422.00 C 80.47 439.62 81.03 447.62 82.07 450.50 L 83.51 454.50 L 119.00 454.85 L 119.00 434.05 C 119.00 422.61 119.29 411.82 119.64 410.06 C 119.99 408.31 121.60 405.56 123.21 403.94 C 125.63 401.52 126.99 401.00 130.85 401.00 C 133.58 401.00 136.53 401.68 137.88 402.63 C 142.48 405.85 143.11 409.52 143.00 432.34 C 142.94 443.98 142.92 454.09 142.95 454.82 C 142.99 455.87 146.70 456.07 161.42 455.82 L 179.85 455.50 L 180.48 450.00 C 181.01 445.35 181.71 428.12 181.94 413.65 C 181.99 410.65 182.75 409.05 185.40 406.40 C 188.30 403.50 189.49 403.00 193.50 403.00 C 197.51 403.00 198.70 403.50 201.60 406.40 L 205.00 409.80 L 205.01 424.65 C 205.01 432.82 205.30 443.19 205.65 447.70 L 206.29 455.91 L 211.89 456.21 C 214.98 456.37 218.62 456.33 220.00 456.11 C 221.38 455.90 226.77 455.61 232.00 455.47 C 237.23 455.33 242.03 455.17 242.69 455.11 C 243.56 455.03 243.90 449.17 243.96 432.85 C 244.05 409.20 244.66 405.75 249.35 402.47 C 252.11 400.54 259.97 400.59 262.78 402.56 C 267.59 405.93 268.00 408.30 268.00 432.95 L 268.00 456.00 L 271.75 455.99 C 273.81 455.99 279.44 455.53 284.26 454.98 C 290.52 454.26 294.30 454.30 297.51 455.11 C 302.68 456.41 304.36 455.59 305.47 451.22 C 305.86 449.72 306.53 437.25 306.97 423.50 C 307.41 409.66 308.29 396.81 308.94 394.72 C 310.66 389.16 314.81 385.03 324.68 379.05 C 343.75 367.51 354.02 357.22 360.90 342.77 C 364.84 334.52 371.08 330.81 377.94 332.64 L 381.50 333.59 L 381.45 329.53 C 381.70 332.71 382.08 333.65 382.65 334.13 C 385.98 336.88 387.00 341.62 387.00 354.22 C 387.00 376.25 382.85 403.11 376.93 419.33 C 372.78 430.73 367.68 439.24 360.35 447.01 C 350.02 457.97 344.97 460.43 330.50 461.61 C 328.85 461.74 323.46 462.22 318.53 462.68 L 309.55 463.50 L 307.89 468.00 C 306.41 472.02 305.82 472.57 302.37 473.19 C 293.10 474.86 262.05 478.02 245.64 478.97 C 225.43 480.14 162.64 480.11 141.50 478.92 z M 254.28 123.12 C 229.12 119.97 200.30 118.79 173.50 120.19 C 161.40 120.82 148.80 121.37 145.50 121.42 C 142.20 121.46 139.24 121.85 138.93 122.27 C 138.61 122.69 134.16 123.72 129.03 124.55 C 134.16 123.72 138.72 122.47 139.16 121.77 C 139.61 121.07 139.98 118.57 139.98 116.20 C 140.00 110.71 142.08 106.72 146.23 104.21 C 150.98 101.33 165.86 98.16 180.89 96.82 C 203.46 94.81 232.00 98.71 243.32 105.34 C 248.10 108.14 248.30 108.63 249.24 119.47 L 249.50 122.45 z';
const KN_FACE_D =
    'M 211.89 456.21 L 206.29 455.91 L 205.65 447.70 C 205.30 443.19 205.01 432.82 205.01 424.65 L 205.00 409.80 L 201.60 406.40 C 198.70 403.50 197.51 403.00 193.50 403.00 C 189.49 403.00 188.30 403.50 185.40 406.40 C 182.75 409.05 181.99 410.65 181.94 413.65 C 181.71 428.12 181.01 445.35 180.48 450.00 L 179.85 455.50 L 161.42 455.82 C 146.70 456.07 142.99 455.87 142.95 454.82 C 142.92 454.09 142.94 443.98 143.00 432.34 C 143.11 409.52 142.48 405.85 137.88 402.63 C 136.53 401.68 133.58 401.00 130.85 401.00 C 126.99 401.00 125.63 401.52 123.21 403.94 C 121.60 405.56 119.99 408.31 119.64 410.06 C 119.29 411.82 119.00 422.61 119.00 434.05 L 119.00 454.85 L 101.25 454.67 L 83.51 454.50 L 82.07 450.50 C 81.03 447.62 80.47 439.62 80.06 422.00 C 79.50 397.59 79.49 397.48 76.64 391.69 C 73.97 386.24 72.99 385.35 61.14 377.56 C 54.19 372.99 46.96 367.96 45.09 366.38 C 39.80 361.92 30.87 350.21 27.01 342.68 C 22.61 334.09 18.91 331.50 12.17 332.29 L 7.50 332.85 L 8.10 286.17 C 8.70 239.26 8.92 236.21 12.89 219.00 C 17.69 198.15 29.73 176.49 44.83 161.54 C 65.06 141.52 88.92 131.03 129.03 124.55 C 134.16 123.72 138.61 122.69 138.93 122.27 C 139.24 121.85 142.20 121.46 145.50 121.42 C 148.80 121.37 161.40 120.82 173.50 120.19 C 220.74 117.73 274.25 123.24 303.00 133.54 C 338.28 146.16 364.10 173.71 374.59 209.92 C 379.99 228.53 380.29 232.13 380.92 284.55 L 381.50 333.59 L 377.94 332.64 C 371.08 330.81 364.84 334.52 360.90 342.77 C 354.02 357.22 343.75 367.51 324.68 379.05 C 314.81 385.03 310.66 389.16 308.94 394.72 C 308.29 396.81 307.41 409.66 306.97 423.50 C 306.53 437.25 305.86 449.72 305.47 451.22 C 304.36 455.59 302.68 456.41 297.51 455.11 C 294.30 454.30 290.52 454.26 284.26 454.98 C 279.44 455.53 273.81 455.99 271.75 455.99 L 268.00 456.00 L 268.00 432.95 C 268.00 408.30 267.59 405.93 262.78 402.56 C 259.97 400.59 252.11 400.54 249.35 402.47 C 244.66 405.75 244.05 409.20 243.96 432.85 C 243.90 449.17 243.56 455.03 242.69 455.11 C 242.03 455.17 237.23 455.33 232.00 455.47 C 226.77 455.61 221.38 455.90 220.00 456.11 C 218.62 456.33 214.98 456.37 211.89 456.21 Z M 237.02 382.97 C 252.61 381.79 284.93 377.13 299.50 373.96 C 321.03 369.27 330.76 364.97 340.48 355.85 L 346.50 350.20 L 346.50 325.35 C 346.50 304.60 346.21 299.43 344.72 294.00 C 337.63 268.16 323.39 257.61 287.50 251.61 C 234.84 242.80 170.46 241.84 116.50 249.07 C 68.35 255.52 51.47 266.12 44.57 294.22 C 42.57 302.36 41.44 326.87 42.45 340.25 L 43.19 350.00 L 48.27 354.98 C 54.13 360.72 65.41 366.87 75.50 369.83 C 93.01 374.96 130.53 381.26 153.47 382.92 C 169.91 384.11 221.57 384.14 237.02 382.97 Z M 105.03 232.48 C 110.46 229.68 111.17 226.72 110.82 208.34 L 110.50 191.83 L 107.23 188.92 C 102.12 184.35 95.03 185.30 91.67 190.99 C 90.30 193.31 90.00 196.69 90.00 209.97 C 90.00 219.48 90.44 226.95 91.06 228.12 C 92.35 230.52 97.81 233.99 100.30 234.00 C 101.29 234.00 103.42 233.32 105.03 232.48 Z M 294.13 232.43 C 299.01 229.91 300.00 225.99 300.00 209.18 C 300.00 195.34 299.84 194.06 297.72 190.91 C 293.51 184.66 285.03 184.35 280.79 190.29 C 278.62 193.33 278.50 194.39 278.50 210.17 C 278.50 226.57 278.54 226.88 281.00 229.53 C 285.28 234.13 289.18 235.00 294.13 232.43 Z M 152.58 226.34 C 157.09 223.42 157.50 221.01 157.50 197.60 C 157.50 178.39 157.27 175.08 155.74 172.28 C 153.50 168.19 151.24 167.00 145.70 167.00 C 140.62 167.00 136.92 169.37 135.08 173.80 C 134.25 175.82 133.98 183.44 134.20 199.26 C 134.50 221.64 134.52 221.87 136.94 224.44 C 141.09 228.85 147.50 229.63 152.58 226.34 Z M 249.83 226.30 C 254.33 223.49 255.00 219.70 255.00 196.98 C 255.00 174.45 254.53 171.89 249.78 168.56 C 246.51 166.27 238.86 166.54 235.66 169.05 C 231.43 172.38 230.83 176.55 231.18 200.17 C 231.50 221.58 231.53 221.88 233.94 224.44 C 238.14 228.90 244.49 229.64 249.83 226.30 Z M 200.91 224.54 C 206.66 221.58 207.00 219.34 207.00 185.00 C 207.00 158.20 206.77 153.32 205.37 150.36 C 201.29 141.76 187.04 141.87 183.42 150.53 C 181.27 155.68 181.35 215.84 183.51 220.02 C 186.35 225.52 194.79 227.71 200.91 224.54 Z';
const KNIGHT_WARP = {
    back: buildWarpLayers(KNIGHT_T, [
        { d: KN_PLUME_D, fill: 'rgb(0,93,245)' },
        { d: KN_WINDOW_D, fill: 'rgb(159,162,169)' },
    ]),
    front: buildWarpLayers(KNIGHT_T, [
        { d: KN_SLITS_D, fill: 'rgb(159,162,169)' },
        { d: KN_PLATE_D, fill: 'rgb(159,162,169)' },
        { d: KN_FACE_D, fill: 'rgb(201,204,212)', fillRule: 'evenodd' },
    ]),
};

// Bird v4 (Fable export, outline-free aesthetic): blue body, twin white eye
// patches, black beak duplicated as a front occluder. Drawn eye capsules and
// highlights stripped — the engine draws live eyes clipped to the patches, so
// at gaze extremes they cut against the patch edge instead of sliding onto
// the blue body.
const BIRD_T =
    'translate(12.738 -17.322) scale(1.3054) matrix(0.629405 0 0 0.626499 173.459393 172.082772)  translate(-277.187809, -305.115681)';
const BIRD_BLUE_D =
    'M 211.00 578.97 C 143.52 577.44 116.93 573.47 92.50 561.25 C 66.72 548.35 46.79 524.92 37.59 496.68 C 34.04 485.78 31.71 472.65 32.51 467.94 L 33.17 464.03 L 28.96 465.51 C 20.98 468.33 12.94 466.91 8.30 461.87 C 7.09 460.55 5.07 457.23 3.82 454.49 C 1.86 450.19 1.55 447.91 1.60 438.00 C 1.64 428.06 2.03 425.42 4.45 418.50 C 9.45 404.21 16.38 391.45 25.14 380.36 L 30.00 374.22 L 30.00 315.16 C 30.00 253.98 30.50 244.23 34.61 225.00 C 43.13 185.10 64.21 156.88 98.62 139.26 C 119.20 128.73 147.47 122.20 173.80 121.90 C 186.54 121.75 186.87 121.58 191.60 112.80 C 210.44 77.80 245.04 47.45 280.12 35.17 C 308.31 25.30 331.21 31.27 334.99 49.47 C 336.42 56.36 335.61 63.23 332.34 72.00 C 329.88 78.59 323.95 89.29 318.81 96.41 C 317.26 98.56 316.16 100.49 316.37 100.71 C 316.58 100.92 319.15 99.68 322.07 97.96 C 349.86 81.57 373.20 75.01 388.18 79.36 C 403.88 83.93 406.45 101.40 394.07 119.40 C 392.38 121.85 391.00 124.05 391.00 124.28 C 391.00 124.51 395.16 124.97 400.25 125.31 C 411.15 126.03 427.44 129.04 438.77 132.43 C 476.30 143.67 502.78 168.92 514.31 204.50 C 522.75 230.53 523.24 236.08 523.73 310.55 L 524.14 374.59 L 529.63 381.43 C 548.39 404.83 557.02 433.33 550.76 451.25 C 548.79 456.90 543.65 463.47 539.75 465.31 C 535.77 467.20 529.22 467.50 524.06 466.02 C 522.17 465.48 520.45 465.22 520.22 465.45 C 519.99 465.68 520.33 467.46 520.97 469.41 C 523.24 476.28 517.55 500.11 510.18 514.60 C 502.60 529.52 488.71 545.04 474.50 554.47 C 454.94 567.45 436.70 573.18 404.50 576.45 C 373.62 579.59 287.73 580.71 211.00 578.97 Z M 281.40 514.90 C 284.03 512.83 289.32 505.97 296.40 495.59 C 292.71 501.18 290.00 505.40 290.00 505.55 C 290.00 505.74 292.14 506.05 294.75 506.25 C 297.36 506.46 305.35 506.49 312.50 506.32 C 319.65 506.16 336.52 505.78 350.00 505.48 C 375.92 504.90 393.92 503.20 403.00 500.47 C 427.68 493.03 441.99 472.38 446.07 438.30 C 447.73 424.42 448.46 348.15 447.05 335.98 C 442.42 296.21 418.46 273.07 381.82 273.02 C 353.41 272.97 333.33 284.98 322.46 308.50 C 314.26 326.26 312.90 336.88 312.27 388.17 L 311.76 429.84 L 315.76 431.88 C 317.11 432.56 318.31 433.33 319.38 434.15 C 316.21 431.90 311.54 429.91 304.99 427.85 C 298.11 425.69 295.78 425.50 276.50 425.51 C 259.31 425.53 254.33 425.86 249.07 427.34 C 241.94 429.35 236.19 432.06 232.61 435.07 C 233.68 434.12 234.86 433.22 236.12 432.42 L 240.00 429.97 L 239.99 398.24 C 239.96 334.27 237.36 317.17 224.83 298.44 C 213.46 281.44 196.41 273.00 173.43 273.00 C 144.26 273.00 124.46 284.00 113.54 306.27 C 104.54 324.62 103.64 332.78 104.27 390.72 C 104.64 424.69 105.13 437.79 106.32 445.00 C 110.36 469.60 121.34 487.03 138.19 495.59 C 147.88 500.51 163.51 503.51 187.00 504.94 C 205.13 506.05 261.00 506.17 261.00 505.10 C 261.00 504.77 258.78 501.03 255.51 495.78 C 261.93 505.50 267.55 513.28 269.76 515.03 C 273.02 517.59 278.05 517.54 281.40 514.90 Z M 230.36 453.91 C 232.96 459.09 237.27 466.61 242.14 474.64 C 236.56 465.62 232.73 458.91 230.36 453.91 Z M 324.97 443.54 C 325.30 446.55 324.61 449.84 322.85 453.29 C 322.24 454.49 321.32 456.14 320.15 458.15 C 324.16 451.17 325.00 448.34 325.00 444.62 C 325.00 444.25 324.99 443.89 324.97 443.54 Z M 230.01 437.79 C 227.97 440.40 227.13 442.59 227.30 445.17 C 227.17 444.16 227.21 443.32 227.38 442.61 C 227.76 441.09 228.69 439.42 230.01 437.79 Z';
const BIRD_WHITE_D =
    'M 294.75 506.25 C 292.14 506.05 290.00 505.74 290.00 505.55 C 290.00 505.36 293.99 499.20 298.87 491.86 C 309.32 476.11 319.84 459.20 322.85 453.29 C 327.41 444.36 324.80 436.49 315.76 431.88 L 311.76 429.84 L 312.27 388.17 C 312.90 336.88 314.26 326.26 322.46 308.50 C 333.33 284.98 353.41 272.97 381.82 273.02 C 418.46 273.07 442.42 296.21 447.05 335.98 C 448.46 348.15 447.73 424.42 446.07 438.30 C 441.99 472.38 427.68 493.03 403.00 500.47 C 393.92 503.20 375.92 504.90 350.00 505.48 C 336.52 505.78 319.65 506.16 312.50 506.32 C 305.35 506.49 297.36 506.46 294.75 506.25 Z M 187.00 504.94 C 163.51 503.51 147.88 500.51 138.19 495.59 C 121.34 487.03 110.36 469.60 106.32 445.00 C 105.13 437.79 104.64 424.69 104.27 390.72 C 103.64 332.78 104.54 324.62 113.54 306.27 C 124.46 284.00 144.26 273.00 173.43 273.00 C 196.41 273.00 213.46 281.44 224.83 298.44 C 237.36 317.17 239.96 334.27 239.99 398.24 L 240.00 429.97 L 236.12 432.42 C 231.70 435.21 228.22 439.27 227.38 442.61 C 226.14 447.55 232.02 459.10 250.17 487.35 C 256.13 496.62 261.00 504.61 261.00 505.10 C 261.00 506.17 205.13 506.05 187.00 504.94 Z';
const BIRD_BEAK_D =
    'M 281.40 514.90 C 278.05 517.54 273.02 517.59 269.76 515.03 C 263.62 510.20 231.41 458.97 228.05 448.70 C 226.54 444.06 227.18 441.12 230.63 437.03 C 233.81 433.25 240.43 429.77 249.07 427.34 C 254.33 425.86 259.31 425.53 276.50 425.51 C 295.78 425.50 298.11 425.69 304.99 427.85 C 319.83 432.51 325.00 436.84 325.00 444.62 C 325.00 449.68 323.44 453.08 314.51 467.50 C 298.54 493.31 285.97 511.31 281.40 514.90 Z';
const BIRD_WARP = {
    back: buildWarpLayers(BIRD_T, [
        { d: BIRD_BLUE_D, fill: 'rgb(2,99,226)' },
        { d: BIRD_WHITE_D, fill: 'rgb(249,250,250)' },
    ]),
    front: buildWarpLayers(BIRD_T, [{ d: BIRD_BEAK_D, fill: 'rgb(0,0,0)' }]),
};

// Robot v4 (Fable export, outline-free): gray shell with antenna + side
// ears, white screen, no mouth. Drawn eye capsules + highlights stripped —
// engine eyes clip to the screen. The art's eyes sit closer together and
// larger than the v3 standard, so this head carries its own slot + eyeScale.
const ROBOT_T =
    'translate(21.117 -10.01) scale(1.144) matrix(0.41218 0 0 0.429607 191.332495 201.051701)  translate(-464.696278, -469.76969)';
const ROBOT_GRAY_D =
    'M 288.00 936.94 C 240.79 935.38 209.41 928.78 181.00 914.46 C 137.62 892.60 107.54 858.11 93.69 814.34 C 86.35 791.13 82.80 765.20 80.73 719.50 L 80.50 714.50 L 69.00 713.89 C 60.29 713.43 55.56 712.63 49.51 710.57 C 25.88 702.54 8.96 684.21 2.37 659.50 C 0.61 652.91 0.50 647.20 0.50 562.00 C 0.50 479.54 0.42 468.92 3.65 459.41 C 4.22 457.74 4.88 456.11 5.67 454.14 C 13.77 433.80 31.64 417.50 52.50 411.44 C 55.80 410.48 63.45 409.42 69.50 409.10 L 80.50 408.50 L 81.70 388.53 C 83.75 354.22 87.11 332.20 93.22 313.00 C 111.92 254.20 159.95 211.55 223.12 197.66 C 252.61 191.17 274.09 190.01 365.14 190.00 C 431.37 190.00 438.85 189.84 439.39 188.42 C 440.26 186.15 440.11 122.71 439.23 121.42 C 438.83 120.83 436.25 119.25 433.50 117.92 C 430.65 116.54 425.04 112.06 420.44 107.50 C 405.02 92.18 398.73 73.42 402.32 53.43 C 407.80 22.98 433.60 1.72 465.00 1.78 C 476.71 1.80 484.90 3.83 495.50 9.32 C 509.03 16.35 519.90 29.08 525.08 44.00 C 526.69 48.61 527.47 53.58 527.78 61.09 C 528.28 73.36 526.14 83.17 520.70 93.46 C 516.50 101.43 504.32 113.56 496.24 117.83 L 489.97 121.13 L 490.24 155.32 L 490.50 189.50 L 574.50 190.09 C 666.39 190.74 675.91 191.25 706.00 197.15 C 760.90 207.92 808.18 244.61 829.52 293.00 C 840.99 319.00 845.08 341.28 848.81 398.00 L 849.50 408.50 L 860.50 409.10 C 876.46 409.96 885.92 413.14 899.08 422.06 C 910.76 429.98 921.27 444.59 925.93 459.37 L 928.49 467.50 L 928.81 557.00 C 929.04 621.36 928.80 648.61 927.97 654.00 C 922.91 686.68 895.35 711.98 863.00 713.64 C 855.84 714.00 852.41 713.76 850.71 715.35 C 848.78 717.15 849.04 721.28 848.61 731.23 C 846.65 777.17 840.26 808.70 827.38 835.93 C 806.60 879.84 767.49 912.44 718.66 926.53 C 695.98 933.07 673.96 935.86 636.00 937.01 C 601.58 938.05 319.62 937.99 288.00 936.94 Z M 283.88 779.91 C 288.62 780.38 372.60 780.67 470.50 780.57 C 636.01 780.39 651.14 780.66 665.19 776.91 C 667.71 776.24 670.19 775.44 673.50 774.48 C 708.52 764.36 737.57 740.80 752.98 710.02 C 759.39 697.23 762.50 688.24 765.76 673.15 L 768.50 660.50 L 768.50 584.50 C 768.50 519.53 768.61 506.63 765.54 494.53 C 764.65 491.03 763.50 487.59 761.99 482.96 C 755.20 462.07 744.57 444.59 729.56 429.60 C 710.58 410.64 687.25 398.18 658.88 391.82 L 648.50 389.50 L 281.50 389.50 L 271.04 391.81 C 224.11 402.18 186.14 433.03 169.50 474.30 C 159.64 498.74 158.56 511.47 159.32 593.50 C 159.92 657.94 160.32 663.61 165.44 682.40 C 178.81 731.40 215.40 765.73 266.33 777.07 C 271.24 778.17 279.14 779.45 283.88 779.91 Z';
const ROBOT_SCREEN_D =
    'M 283.88 779.91 C 279.14 779.45 271.24 778.17 266.33 777.07 C 215.40 765.73 178.81 731.40 165.44 682.40 C 160.32 663.61 159.92 657.94 159.32 593.50 C 158.56 511.47 159.64 498.74 169.50 474.30 C 186.14 433.03 224.11 402.18 271.04 391.81 L 281.50 389.50 L 465.00 389.50 L 648.50 389.50 L 658.88 391.82 C 687.25 398.18 710.58 410.64 729.56 429.60 C 744.57 444.59 755.20 462.07 761.99 482.96 C 768.68 503.53 768.50 500.69 768.50 584.50 L 768.50 660.50 L 765.76 673.15 C 762.50 688.24 759.39 697.23 752.98 710.02 C 737.57 740.80 708.52 764.36 673.50 774.48 C 651.73 780.77 665.65 780.35 470.50 780.57 C 372.60 780.67 288.62 780.38 283.88 779.91 Z';
const ROBOT_WARP = {
    back: buildWarpLayers(ROBOT_T, [
        { d: ROBOT_GRAY_D, fill: 'rgb(159,162,169)', fillRule: 'evenodd' },
        { d: ROBOT_SCREEN_D, fill: 'rgb(253,253,253)' },
    ]),
    front: [],
};
// Alien v4 (Fable export, outline-free): green head with antenna + pointy
// ears, three white sockets, black mouth showing through the head's knockout.
// Drawn eye discs + glints stripped — engine eyes clip to the sockets in a
// wide round pose matching the drawn discs, and the forehead socket hosts the
// engine's third eye (see HeadSpec.thirdEye).
const ALIEN_T =
    'translate(0.768 -4.892) scale(1.08611) matrix(0.630105 0 0 0.626492 217.616828 189.605561)  translate(-367.500776, -303.823278)';
const ALIEN_MOUTH_D =
    'M 377.04 537.99 C 363.17 540.62 348.99 536.02 338.68 525.55 C 324.15 510.79 322.84 493.00 336.28 493.00 C 341.45 493.00 343.43 494.76 347.50 503.00 C 352.77 513.66 358.49 517.42 369.50 517.47 C 375.38 517.50 377.25 517.06 381.22 514.73 C 386.04 511.89 390.61 506.26 393.29 499.86 C 395.16 495.37 398.45 493.00 402.79 493.00 C 407.23 493.00 409.65 494.41 411.58 498.15 C 414.78 504.33 409.63 516.20 399.56 525.87 C 392.60 532.55 385.46 536.40 377.04 537.99 Z';
const ALIEN_GREEN_D =
    'M 300.00 606.01 C 261.91 605.17 248.92 604.22 231.77 601.02 C 185.03 592.30 151.53 568.20 132.03 529.26 C 121.67 508.56 115.11 481.30 112.46 447.92 L 111.86 440.34 L 103.81 437.05 C 64.36 420.92 36.86 378.16 26.61 317.00 C 21.57 286.96 20.59 246.09 24.68 237.00 C 27.31 231.17 29.90 228.96 34.90 228.29 C 40.43 227.54 46.86 230.87 59.37 240.94 C 72.15 251.23 99.55 276.60 107.22 285.25 C 110.51 288.96 113.76 292.00 114.44 292.00 C 115.19 292.00 116.56 287.97 117.95 281.75 C 129.74 228.68 158.34 190.74 202.12 170.09 C 235.98 154.12 274.92 146.22 330.25 144.12 C 342.33 143.66 349.41 142.99 350.16 142.24 C 350.98 141.42 351.47 132.46 351.80 112.66 L 352.27 84.26 L 346.88 80.28 C 327.70 66.10 322.17 45.35 332.16 25.03 C 337.99 13.18 349.24 4.68 362.83 1.87 C 375.38 -0.72 390.22 4.09 400.06 13.93 C 416.58 30.46 417.12 55.41 401.34 72.97 C 398.83 75.76 394.79 79.21 392.38 80.62 C 389.68 82.20 387.75 84.16 387.36 85.69 C 386.27 90.05 387.54 140.94 388.77 142.17 C 389.45 142.85 397.13 143.61 408.28 144.09 C 462.32 146.46 501.74 154.59 533.70 169.97 C 560.66 182.94 578.51 197.96 593.16 220.00 C 603.74 235.91 613.68 260.57 617.89 281.36 C 618.99 286.78 620.14 291.47 620.45 291.78 C 620.76 292.09 630.12 283.36 641.26 272.38 C 681.64 232.55 696.72 222.85 706.06 230.70 C 711.28 235.10 712.25 238.75 712.76 256.00 C 713.75 288.87 707.77 331.22 698.32 358.38 C 684.69 397.55 661.48 424.66 630.88 437.17 L 623.18 440.32 L 622.51 448.41 C 621.44 461.30 618.30 482.72 616.03 492.50 C 612.98 505.68 610.37 513.17 604.54 525.55 C 584.08 568.95 547.21 594.47 493.50 602.42 C 488.00 603.23 475.40 604.36 465.50 604.92 C 440.40 606.34 343.78 606.97 300.00 606.01 Z M 358.50 368.37 C 360.15 368.62 366.23 368.70 372.01 368.55 C 383.97 368.22 395.52 364.90 405.69 358.87 C 414.19 353.83 426.74 340.85 431.69 332.00 C 445.61 307.12 446.26 279.41 433.54 253.50 C 428.10 242.44 421.10 233.82 411.67 226.60 C 397.97 216.12 383.12 211.40 366.51 212.25 C 339.58 213.64 318.27 228.62 304.61 255.77 C 294.42 276.02 293.94 302.98 303.39 324.34 C 313.62 347.47 335.29 364.79 358.50 368.37 Z M 234.54 495.94 C 246.77 497.83 262.44 495.28 274.13 489.51 C 283.38 484.93 289.52 480.37 296.37 472.97 C 323.75 443.39 323.35 393.80 295.50 364.19 C 280.53 348.28 264.45 341.05 243.98 341.01 C 197.64 340.94 162.68 387.83 172.56 436.79 C 174.69 447.37 182.32 462.75 189.67 471.26 C 201.68 485.19 216.04 493.08 234.54 495.94 Z M 476.50 494.04 C 484.49 496.15 497.68 496.54 506.57 494.92 C 528.92 490.84 550.14 473.76 559.68 452.18 C 566.67 436.38 568.43 414.91 564.08 398.50 C 552.55 355.05 511.17 330.87 471.67 344.50 C 442.75 354.48 421.09 386.19 421.02 418.66 C 420.96 444.96 432.83 468.62 453.57 483.55 C 460.67 488.66 466.82 491.47 476.50 494.04 Z M 377.04 537.99 C 385.46 536.40 392.60 532.55 399.56 525.87 C 409.63 516.20 414.78 504.33 411.58 498.15 C 409.65 494.41 407.23 493.00 402.79 493.00 C 398.45 493.00 395.16 495.37 393.29 499.86 C 390.61 506.26 386.04 511.89 381.22 514.73 C 377.25 517.06 375.38 517.50 369.50 517.47 C 358.49 517.42 352.77 513.66 347.50 503.00 C 343.43 494.76 341.45 493.00 336.28 493.00 C 322.84 493.00 324.15 510.79 338.68 525.55 C 348.99 536.02 363.17 540.62 377.04 537.99 Z';
const ALIEN_SOCKETS_D =
    'M 234.54 495.94 C 216.04 493.08 201.68 485.19 189.67 471.26 C 182.32 462.75 174.69 447.37 172.56 436.79 C 162.68 387.83 197.64 340.94 243.98 341.01 C 264.45 341.05 280.53 348.28 295.50 364.19 C 323.35 393.80 323.75 443.39 296.37 472.97 C 289.52 480.37 283.38 484.93 274.13 489.51 C 262.44 495.28 246.77 497.83 234.54 495.94 Z M 476.50 494.04 C 466.82 491.47 460.67 488.66 453.57 483.55 C 432.83 468.62 420.96 444.96 421.02 418.66 C 421.09 386.19 442.75 354.48 471.67 344.50 C 511.17 330.87 552.55 355.05 564.08 398.50 C 568.43 414.91 566.67 436.38 559.68 452.18 C 550.14 473.76 528.92 490.84 506.57 494.92 C 497.68 496.54 484.49 496.15 476.50 494.04 Z M 358.50 368.37 C 335.29 364.79 313.62 347.47 303.39 324.34 C 293.94 302.98 294.42 276.02 304.61 255.77 C 318.27 228.62 339.58 213.64 366.51 212.25 C 383.12 211.40 397.97 216.12 411.67 226.60 C 421.10 233.82 428.10 242.44 433.54 253.50 C 446.26 279.41 445.61 307.12 431.69 332.00 C 426.74 340.85 414.19 353.83 405.69 358.87 C 395.52 364.90 383.97 368.22 372.01 368.55 C 366.23 368.70 360.15 368.62 358.50 368.37 Z';
const ALIEN_WARP = {
    back: buildWarpLayers(ALIEN_T, [
        { d: ALIEN_MOUTH_D, fill: 'rgb(0,0,0)' },
        { d: ALIEN_GREEN_D, fill: 'rgb(158,202,54)' },
        { d: ALIEN_SOCKETS_D, fill: 'rgb(249,249,249)' },
    ]),
    front: [],
};

// Blob v1 (Fable export): one orange splat silhouette. The drawn black eye
// ovals + their white highlight backers are stripped — the engine draws its
// eyes (and highlights) directly on the splat. The art's eyes sit high,
// close together, and much larger than the standard frame, so the head
// carries its own slot + a big eyeScale.
const BLOB_T = 'translate(6.702 1.477) scale(1.2)';
const BLOB_BODY_D =
    'M 70.37025478986472 48.96522002546493 C 51.465076184742635 48.96522002546493 33.58532945413469 57.560527753103656 21.777849361019065 72.32498480178123 C 9.97036926790344 87.08944185045878 5.516049973406062 106.42137651065667 9.672191919170828 124.86405153946473 L 20.920519044020192 174.7779487278707 C 23.887760914060845 187.94493827133377 22.439558241500404 201.72248986723002 16.79936897300056 213.98472469488223 L 5.6254601679744844 238.27772040607817 C -3.445321026550868 257.99834391400265 -1.4444723231881227 281.04072950337024 10.889732045137526 298.90268532071104 C 23.22393641346318 316.7646411380518 44.06322590409226 326.7985308478603 65.7183082494271 325.3020444172416 L 109.4896446781833 322.277202028231 C 124.77916924340796 321.22061098518657 140.17696466172578 324.03005705831515 152.9131230391425 331.2193715790213 L 201.6898063856725 362.30258864649346 C 217.1913925223704 374.3762472302207 237.48516055631464 378.4182505321527 256.4297800839075 373.20540147385225 C 275.3743996115004 367.99255241555187 290.7435550043406 354.1374495931583 297.88620949420465 335.83294492386165 L 320.23318112460436 290.25925363909005 C 323.0603606331871 283.01403120963755 327.2208143323886 276.36306790667317 332.4989465605479 270.65101816878916 L 372.3068089219877 227.57053440328752 C 384.2177620234221 214.68037674902888 390.13079894060866 197.35932049235976 388.58852235475354 179.87651891283792 C 387.0462457688982 162.3937173333161 378.19211406775014 146.3753732475675 364.20842172743494 135.76955801875923 L 335.38832933358844 113.91119848340995 C 323.2509697186913 104.7057189642362 315.0543424907362 91.24154277755898 312.45045746566063 76.2323411207269 L 307.8848094191146 49.91522974107002 C 304.6571155074371 31.310295828716416 292.8877286405998 15.297410976656977 276.0946303370828 6.662978555302203 C 259.3015320335659 -1.9714538660525562 239.43030652974332 -2.227081491379664 222.42065186281505 5.9725052044464775 L 146.03837581029123 42.79295257866082 C 137.61088131067595 46.855467258194395 128.3757468214134 48.96522002546493 119.02017687284955 48.96522002546493 L 70.37025478986472 48.96522002546493 Z';
const BLOB_WARP = {
    back: buildWarpLayers(BLOB_T, [{ d: BLOB_BODY_D, fill: 'rgb(230,115,0)' }]),
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

    // ── Owl: v5 — purple body, white face mask, front beak occluder,
    //     engine eyes on EYE_FRAME restyled a touch taller to match the art
    owl: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: OWL_WARP, // non-uniform warp: bend + squash-bulge on real geometry
        eyeColor: '#0b0b0b',
        eyeScale: { w: 0.97, h: 1.07 },
        hlColor: '#fdfcfa',
    }),

    // ── Robot: v4 — gray shell, engine eyes clipped to the white screen.
    //     The art's close-set oversized eyes ride a per-head slot + eyeScale.
    robot: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: ROBOT_WARP,
        clip: 1, // white screen layer
        eyeColor: '#020202',
        eyeScale: { w: 1.32, h: 1.25 },
        hlColor: '#fdfdfd',
        slot: { dx: -0.2, dy: 40.8, s: 0.5787 },
    }),
    // ── Bird: style v4 (outline-free) — blue body, twin eye patches, beak
    //     front occluder, eyes clipped to the patches
    bird: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: BIRD_WARP,
        clip: 1, // white patches layer
        eyeColor: '#000000',
        hlColor: '#f9fafa',
    }),

    // ── Alien: style v4 (outline-free) — green head, engine eyes clipped to
    //     the three white sockets, plus a live third eye in the forehead
    //     socket. The sockets are round, so the eyes trade the standard tall
    //     capsule for the drawn art's round pose.
    alien: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: ALIEN_WARP,
        clip: 2, // white sockets layer
        eyeColor: '#000000',
        eyeScale: { w: 0.9, h: 0.56 },
        hlColor: '#f9f9f9',
        thirdEye: { dx: 0.1, dy: -123.9 },
    }),

    // ── Blob: v1 — orange splat, oversized engine eyes drawn straight on
    //     the body (high + close-set via a per-head slot, big eyeScale)
    blob: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: BLOB_WARP,
        eyeColor: '#000000',
        eyeScale: { w: 1.77, h: 1.77 },
        hlColor: '#ffffff',
        slot: { dx: -4.6, dy: -8.3, s: 0.5791 },
    }),

    // ── Knight: v4 — helm + plume, engine eyes sunk into the face window
    //     (per-head slot keeps standard eye size, lowered so the face plate's
    //     window edge occludes the eye bottoms at rest)
    knight: (_dark: boolean) => ({
        back: [],
        front: [],
        warp: KNIGHT_WARP,
        eyeColor: '#0c0c0c',
        hlColor: '#fefefe',
        slot: { dx: 0.3, dy: 85, s: 0.7066 },
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
