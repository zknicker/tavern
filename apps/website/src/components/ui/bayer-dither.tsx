import { type HTMLAttributes, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '../../lib/utils.ts';

/* ------------------------------------------------------------------ */
/*  Shaders — ported from zavalit/bayer-dithering-webgl-demo           */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
void main() {
    gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uPixelSize;
uniform vec3 uColor;
uniform float uFadeRadius;
uniform vec2 uFadeOrigin;

/* ---- hash / value noise (3-D) ---- */
float hash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic smootherstep

    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
        u.z);
}

/* ---- fBm — 5 octaves ---- */
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
        value += amplitude * vnoise(p * frequency);
        frequency *= 1.25;
        amplitude *= 1.0;
    }
    return value / 5.0;
}

/* ---- Bayer matrices (recursive) ---- */
float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float Bayer4(vec2 a)  { return Bayer2(0.5 * a) * 0.25 + Bayer2(a); }
float Bayer8(vec2 a)  { return Bayer4(0.5 * a) * 0.25 + Bayer2(a); }

void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = fragCoord / uResolution;
    // Flip Y so origin is top-left
    uv.y = 1.0 - uv.y;

    /* ---- noise field ---- */
    float feed = fbm(vec3(uv * 4.0, uTime * 0.05));
    feed = feed * 0.5 - 0.65;

    /* ---- radial fade from origin ---- */
    vec2 biased = (uv - uFadeOrigin) * vec2(1.6, 1.0);
    float dist = length(biased);
    float fade = 1.0 - smoothstep(0.0, uFadeRadius, dist);
    feed += fade;

    /* ---- Bayer dithering ---- */
    vec2 cellCoord = fragCoord / uPixelSize;
    float bayer = Bayer8(cellCoord);
    float bw = step(0.5, feed + bayer * 0.25);

    if (bw < 0.5) discard;

    /* ---- square pixel mask ---- */
    vec2 pixelUV = fract(fragCoord / uPixelSize);
    float gap = 0.15;
    float mask = step(gap, pixelUV.x) * step(gap, pixelUV.y)
               * (1.0 - step(1.0 - gap, pixelUV.x)) * (1.0 - step(1.0 - gap, pixelUV.y));

    gl_FragColor = vec4(uColor, mask * 0.6);
}
`;

const fireworksFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uPixelSize;
uniform vec3  uColor;
uniform float uFadeRadius;

/* ---- hash (reference-style) ---- */
float hash11(float n) { return fract(sin(n) * 43758.5453); }

float vnoise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    vec3 w  = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);

    float n000 = hash11(dot(ip + vec3(0,0,0), vec3(1.0, 57.0, 113.0)));
    float n100 = hash11(dot(ip + vec3(1,0,0), vec3(1.0, 57.0, 113.0)));
    float n010 = hash11(dot(ip + vec3(0,1,0), vec3(1.0, 57.0, 113.0)));
    float n110 = hash11(dot(ip + vec3(1,1,0), vec3(1.0, 57.0, 113.0)));
    float n001 = hash11(dot(ip + vec3(0,0,1), vec3(1.0, 57.0, 113.0)));
    float n101 = hash11(dot(ip + vec3(1,0,1), vec3(1.0, 57.0, 113.0)));
    float n011 = hash11(dot(ip + vec3(0,1,1), vec3(1.0, 57.0, 113.0)));
    float n111 = hash11(dot(ip + vec3(1,1,1), vec3(1.0, 57.0, 113.0)));

    return mix(
        mix(mix(n000, n100, w.x), mix(n010, n110, w.x), w.y),
        mix(mix(n001, n101, w.x), mix(n011, n111, w.x), w.y),
        w.z) * 2.0 - 1.0;
}

float fbm(vec2 uv, float t) {
    vec3 p    = vec3(uv * 4.0, t);
    float amp  = 1.0;
    float freq = 1.0;
    float sum  = 1.0;
    for (int i = 0; i < 5; i++) {
        sum  += amp * vnoise(p * freq);
        freq *= 1.25;
        amp  *= 1.0;
    }
    return sum * 0.5 + 0.5;
}

/* ---- Bayer matrices ---- */
float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float Bayer4(vec2 a) { return Bayer2(0.5 * a) * 0.25 + Bayer2(a); }
float Bayer8(vec2 a) { return Bayer4(0.5 * a) * 0.25 + Bayer2(a); }

/* ---- palette ---- */
vec3 getPaletteColor(int i) {
    if (i == 0) return vec3(0.957, 0.620, 0.043); // amber
    if (i == 1) return vec3(0.337, 0.718, 0.957); // sky blue
    if (i == 2) return vec3(0.957, 0.337, 0.459); // coral/pink
    if (i == 3) return vec3(0.420, 0.957, 0.576); // mint green
    if (i == 4) return vec3(0.678, 0.420, 0.957); // lavender
    return vec3(0.957, 0.835, 0.337);              // warm yellow
}

void main() {
    float pixelSize = uPixelSize;
    vec2 fragCoord = gl_FragCoord.xy;
    float aspectRatio = uResolution.x / uResolution.y;

    /* ---- cell-based UV for dither feed (same as reference) ---- */
    float cellPixelSize = 8.0 * pixelSize;
    vec2 cellId    = floor((fragCoord - uResolution * 0.5) / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    vec2 uv        = cellCoord / uResolution * vec2(aspectRatio, 1.0);

    /* ---- animated fBm feed ---- */
    float feed = fbm(uv, uTime * 0.05);
    feed = feed * 0.5 - 0.65;

    /* ---- separate color noise fields (different scale/offset) ---- */
    float cn1 = fbm(uv * 0.8 + 50.0, uTime * 0.03 + 100.0);
    float cn2 = fbm(uv * 0.6 + 80.0, uTime * 0.025 + 200.0);

    /* ---- Bayer dithering (reference-style) ---- */
    float bayer = Bayer8(fragCoord / pixelSize) - 0.5;
    float bw    = step(0.5, feed + bayer);

    if (bw < 0.5) discard;

    /* ---- square pixel mask ---- */
    vec2 pixelUV = fract(fragCoord / pixelSize);
    float gap = 0.15;
    float mask = step(gap, pixelUV.x) * step(gap, pixelUV.y)
               * (1.0 - step(1.0 - gap, pixelUV.x)) * (1.0 - step(1.0 - gap, pixelUV.y));

    /* ---- color: smooth noise blobs ---- */
    float idx = cn1 * 6.0;
    int i0 = int(floor(idx));
    int i1 = i0 + 1;
    if (i0 > 5) i0 = 5;
    if (i1 > 5) i1 = 0;
    vec3 colorful = mix(getPaletteColor(i0), getPaletteColor(i1), fract(idx));

    /* cn2 controls how much color shows vs base */
    float colorStrength = smoothstep(0.35, 0.65, cn2);
    vec3 col = mix(uColor, colorful, colorStrength * 0.85);

    gl_FragColor = vec4(col, mask * 0.6);
}
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface BayerDitherProps extends HTMLAttributes<HTMLDivElement> {
    color?: string;
    fadeOrigin?: [number, number];
    fadeRadius?: number;
    pixelSize?: number;
    variant?: 'default' | 'fireworks';
}

function hexToVec3(hex: string): THREE.Vector3 {
    const h = hex.replace('#', '');
    return new THREE.Vector3(
        Number.parseInt(h.slice(0, 2), 16) / 255,
        Number.parseInt(h.slice(2, 4), 16) / 255,
        Number.parseInt(h.slice(4, 6), 16) / 255
    );
}

export function BayerDither({
    className,
    color = '#f59e0b',
    fadeOrigin = [0, 0],
    fadeRadius = 0.85,
    pixelSize = 4,
    variant = 'default',
    ...props
}: BayerDitherProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const colorVec = hexToVec3(color);

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: false,
        });
        renderer.setClearColor(0x00_00_00, 0);
        container.appendChild(renderer.domElement);
        renderer.domElement.style.display = 'block';

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();

        const dpr = Math.min(window.devicePixelRatio, 2);

        const isFireworks = variant === 'fireworks';

        const uniforms: Record<string, { value: unknown }> = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2() },
            uPixelSize: { value: pixelSize * dpr },
            uColor: { value: colorVec },
            uFadeRadius: { value: fadeRadius },
            uFadeOrigin: { value: new THREE.Vector2(fadeOrigin[0], fadeOrigin[1]) },
        };

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: isFireworks ? fireworksFragmentShader : fragmentShader,
            uniforms,
            transparent: true,
            depthTest: false,
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(quad);

        const clock = new THREE.Clock();

        const resize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            renderer.setSize(w, h);
            renderer.setPixelRatio(dpr);
            (uniforms.uResolution.value as THREE.Vector2).set(w * dpr, h * dpr);
            uniforms.uPixelSize.value = pixelSize * dpr;
        };

        resize();

        let frameId: number;

        const animate = () => {
            uniforms.uTime.value = clock.getElapsedTime();
            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);

        const observer = new ResizeObserver(resize);
        observer.observe(container);

        return () => {
            cancelAnimationFrame(frameId);
            observer.disconnect();
            renderer.dispose();
            material.dispose();
            container.removeChild(renderer.domElement);
        };
    }, [color, fadeOrigin, fadeRadius, pixelSize, variant]);

    return <div className={cn('pointer-events-none', className)} ref={containerRef} {...props} />;
}
