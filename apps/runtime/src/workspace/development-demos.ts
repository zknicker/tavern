import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorkspaceSource } from './instructions';

const demoWorkspaceFiles = [
    {
        content: [
            '<!doctype html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="utf-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '  <title>Tavern Workspace Preview</title>',
            '  <style>',
            '    body { font: 15px/1.55 system-ui, sans-serif; margin: 0; padding: 32px; color: #171717; }',
            '    main { max-width: 680px; margin: 0 auto; }',
            '    h1 { font-size: 28px; letter-spacing: 0; margin: 0 0 12px; }',
            '    p { margin: 0 0 14px; color: #555; }',
            '    code { border-radius: 6px; background: #f2f2f2; padding: 2px 5px; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <main>',
            '    <h1>Workspace artifact preview</h1>',
            '    <p>This file lives in the active agent workspace and opens from a <code>tavern://workspace/out/preview.html</code> link.</p>',
            '    <p>The panel renders it as sandboxed HTML through Runtime workspace file reads.</p>',
            '  </main>',
            '</body>',
            '</html>',
        ].join('\n'),
        path: 'out/preview.html',
    },
    {
        // Backs the html-preview widget chat demo: self-contained, scripted,
        // and rendered live through the confined workspace file read.
        content: [
            '<!doctype html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="utf-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '  <title>Starfield demo</title>',
            '  <style>',
            '    body { margin: 0; background: #0b1020; color: #e7ecff; font: 14px/1.5 system-ui, sans-serif; }',
            '    main { display: grid; place-items: center; min-height: 100vh; text-align: center; }',
            '    canvas { position: fixed; inset: 0; width: 100%; height: 100%; }',
            '    h1, p, button { position: relative; margin: 6px; }',
            '    button { border: 1px solid #4a5aa8; border-radius: 8px; background: #1a2350; color: inherit; padding: 6px 14px; cursor: pointer; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <canvas id="sky"></canvas>',
            '  <main>',
            '    <div>',
            '      <h1>Starfield demo</h1>',
            '      <p>An agent-authored page rendered inline by the html-preview widget.</p>',
            '      <button id="warp" type="button">Warp speed</button>',
            '    </div>',
            '  </main>',
            '  <script>',
            '    const canvas = document.getElementById("sky");',
            '    const context = canvas.getContext("2d");',
            '    let speed = 0.4;',
            '    const stars = Array.from({ length: 140 }, () => ({',
            '      x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8,',
            '    }));',
            '    document.getElementById("warp").addEventListener("click", () => {',
            '      speed = speed > 2 ? 0.4 : speed * 2;',
            '    });',
            '    function frame() {',
            '      canvas.width = canvas.clientWidth;',
            '      canvas.height = canvas.clientHeight;',
            '      context.fillStyle = "#0b1020";',
            '      context.fillRect(0, 0, canvas.width, canvas.height);',
            '      context.fillStyle = "#e7ecff";',
            '      for (const star of stars) {',
            '        star.y = (star.y + speed * star.z * 0.004) % 1;',
            '        const size = star.z * 1.8;',
            '        context.fillRect(star.x * canvas.width, star.y * canvas.height, size, size);',
            '      }',
            '      requestAnimationFrame(frame);',
            '    }',
            '    frame();',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n'),
        path: 'workbench/demos/html-preview.html',
    },
] as const;

export async function seedDevelopmentWorkspaceDemos({
    enabled = process.env.TAVERN_DEV_STACK === '1',
    sources,
}: {
    enabled?: boolean;
    sources: AgentWorkspaceSource[];
}) {
    if (!enabled) {
        return { seeded: 0 };
    }

    let seeded = 0;
    for (const source of sources) {
        for (const file of demoWorkspaceFiles) {
            const absolutePath = path.join(source.workspaceDir, file.path);
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            await fs.writeFile(absolutePath, `${file.content}\n`);
            seeded += 1;
        }
    }

    return { seeded };
}
