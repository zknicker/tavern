import { defaultEyeParams, type EyeParams, eyeCenterY } from './agent-eyes-config.ts';

const nExp = 2.6;
const ePow = 2 / nExp;
const corner: [number, number][] = [];

for (let i = 0; i <= 10; i += 1) {
    const t = (Math.PI / 2) * (i / 10);
    corner.push([Math.cos(t) ** ePow, Math.sin(t) ** ePow]);
}

const qt = Array.from({ length: 12 }, (_, index) => (index + 1) / 13);

export function resolveStaticEye(params: EyeParams, intensity: number) {
    const clampedIntensity = Math.max(0, Math.min(1.25, intensity));

    return params.map(
        (value, index) =>
            defaultEyeParams[index] + (value - defaultEyeParams[index]) * clampedIntensity
    );
}

export function buildEyePath(params: EyeParams, baseX: number) {
    const cx = baseX + params[0];
    const cy = eyeCenterY + params[1];
    const w = Math.max(8, params[2]);
    const h = Math.max(10, params[3]);
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const yTop = cy - h / 2;
    const yBottom = cy + h / 2;
    const half = Math.min(w / 2, h / 2);
    const clampCorner = (r: number) => Math.max(3, Math.min(r, half));
    const radii = [
        clampCorner(params[4]),
        clampCorner(params[5]),
        clampCorner(params[6]),
        clampCorner(params[7]),
    ];
    const points: number[] = [];
    const push = (x: number, y: number) => points.push(x, y);
    const bumpEdge = (start: number, end: number, y: number, amount: number) => {
        for (const u of qt) {
            const s = Math.sin(Math.PI * u);
            push(start + (end - start) * u, y + amount * s * s);
        }
    };

    push(x0 + radii[0], yTop);
    bumpEdge(x0 + radii[0], x1 - radii[1], yTop, -params[10]);
    push(x1 - radii[1], yTop);
    for (let i = 9; i >= 0; i -= 1) {
        push(x1 - radii[1] + radii[1] * corner[i][0], yTop + radii[1] - radii[1] * corner[i][1]);
    }
    push(x1, yBottom - radii[3]);
    for (let i = 1; i <= 10; i += 1) {
        push(x1 - radii[3] + radii[3] * corner[i][0], yBottom - radii[3] + radii[3] * corner[i][1]);
    }
    bumpEdge(x1 - radii[3], x0 + radii[2], yBottom, params[11]);
    push(x0 + radii[2], yBottom);
    for (let i = 9; i >= 0; i -= 1) {
        push(x0 + radii[2] - radii[2] * corner[i][0], yBottom - radii[2] + radii[2] * corner[i][1]);
    }
    push(x0, yTop + radii[0]);
    for (let i = 1; i <= 10; i += 1) {
        push(x0 + radii[0] - radii[0] * corner[i][0], yTop + radii[0] - radii[0] * corner[i][1]);
    }

    if ((params[13] || 0) > 0.001) {
        crescentBlend(points, cx, cy, w, h, Math.min(1, params[13]));
    }

    return pathFromPoints({
        cx,
        cy,
        hw: w / 2,
        params,
        points,
        rot: (params[12] || 0) * 0.017_453_3,
        yBottom,
        yTop,
    });
}

function pathFromPoints(input: {
    cx: number;
    cy: number;
    hw: number;
    params: EyeParams;
    points: number[];
    rot: number;
    yBottom: number;
    yTop: number;
}) {
    const cosR = Math.cos(input.rot);
    const sinR = Math.sin(input.rot);
    const height = Math.max(1, input.yBottom - input.yTop);
    let d = '';

    for (let i = 0; i < input.points.length; i += 2) {
        let x = input.points[i] ?? 0;
        let y = input.points[i + 1] ?? 0;
        const u = Math.max(0, Math.min(1, (y - input.yTop) / height));
        y +=
            (input.params[8] * (1 - u) * (1 - u) + input.params[9] * u * u) *
            ((x - input.cx) / input.hw);

        if (input.rot) {
            const rx = x - input.cx;
            const ry = y - input.cy;
            x = input.cx + rx * cosR - ry * sinR;
            y = input.cy + rx * sinR + ry * cosR;
        }

        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    return `${d}Z`;
}

function crescentBlend(points: number[], cx: number, cy: number, w: number, th: number, k: number) {
    const sweep = 2.7925;
    const radius = w / 2 / Math.sin(sweep / 2);
    const rise = radius * (1 - Math.cos(sweep / 2));
    const cyA = cy + (radius - rise / 2);
    const curve = (u: number) => {
        const phi = Math.PI / 2 + sweep / 2 - sweep * u;
        return [
            cx + radius * Math.cos(phi),
            cyA - radius * Math.sin(phi),
            Math.cos(phi),
            -Math.sin(phi),
            Math.sin(phi),
            Math.cos(phi),
        ];
    };
    const thick = (u: number) => th * (0.3 + 0.7 * Math.sin(Math.PI * u) ** 0.8);
    const crescent: number[] = [];

    for (let i = 0; i < 26; i += 1) {
        const u = i / 25;
        const q = curve(u);
        const r = thick(u) / 2;
        crescent.push(q[0] + q[2] * r, q[1] + q[3] * r);
    }
    for (let j = 1; j <= 6; j += 1) {
        pushCrescentCap(crescent, curve(1), thick(1) / 2, Math.PI / 2, (-Math.PI * j) / 7, 1);
    }
    for (let i = 0; i < 30; i += 1) {
        const u = 1 - i / 29;
        const q = curve(u);
        const r = thick(u) / 2;
        crescent.push(q[0] - q[2] * r, q[1] - q[3] * r);
    }
    for (let j = 1; j <= 7; j += 1) {
        pushCrescentCap(crescent, curve(0), thick(0) / 2, -Math.PI / 2, (Math.PI * j) / 8, -1);
    }
    for (let i = 0; i < points.length; i += 1) {
        points[i] = points[i] * (1 - k) + (crescent[i] ?? points[i]) * k;
    }
}

function pushCrescentCap(
    points: number[],
    q: number[],
    r: number,
    start: number,
    offset: number,
    normalSign: 1 | -1
) {
    const psi = start + offset;
    points.push(
        q[0] + r * (Math.sin(psi) * q[2] + normalSign * Math.cos(psi) * q[4]),
        q[1] + r * (Math.sin(psi) * q[3] + normalSign * Math.cos(psi) * q[5])
    );
}
