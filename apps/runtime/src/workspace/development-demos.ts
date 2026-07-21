import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorkspaceSource } from './instructions';

export const demoWorkspaceFiles = [
    {
        content: [
            '<!doctype html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="utf-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '  <title>Grotto Workspace Preview</title>',
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
            '    <p>This file lives in the active agent workspace and opens from a <code>grotto://workspace/out/preview.html</code> link.</p>',
            '    <p>The panel renders it as sandboxed HTML through Runtime workspace file reads.</p>',
            '  </main>',
            '</body>',
            '</html>',
        ].join('\n'),
        path: 'out/preview.html',
    },
    {
        // Backs the artifact gallery demo: one self-contained HTML page styled
        // with the injected Tavern theme tokens, opened from the transcript
        // card into the artifact pane's sandboxed preview.
        content: [
            '<!doctype html>',
            '<html lang="en">',
            '<head>',
            '  <meta charset="utf-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '  <title>Fleet status</title>',
            '  <style>',
            '    body { margin: 0; padding: 24px; background: var(--background, #101014); color: var(--foreground, #e5e5e5); font: var(--app-ui-font-size, 14px)/1.5 sans-serif; }',
            '    .card { max-width: 560px; margin: 0 auto 16px; padding: 16px; border: 1px solid var(--border, #333); border-radius: var(--radius-lg, 9px); background: var(--surface-2, #17171c); }',
            '    h1 { margin: 0 0 4px; font-size: 16px; }',
            '    p.meta { margin: 0 0 12px; color: var(--muted-foreground, #9a9aa2); font-size: 12px; }',
            '    table { width: 100%; border-collapse: collapse; font-size: 13px; }',
            '    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border, #333); }',
            '    td.num, th.num { text-align: right; }',
            '    .bar { height: 8px; border-radius: 999px; background: var(--info, #38bdf8); }',
            '    button { margin-top: 12px; padding: 6px 14px; border: 1px solid var(--border-strong, #444); border-radius: var(--radius-md, 7px); background: var(--surface-4, #202028); color: inherit; cursor: pointer; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <div class="card">',
            '    <h1>Fleet status</h1>',
            '    <p class="meta">An agent-built artifact: self-contained HTML wearing the app theme tokens.</p>',
            '    <table>',
            '      <thead><tr><th>Ship</th><th class="num">Sorties</th><th>Load</th></tr></thead>',
            '      <tbody id="fleet"></tbody>',
            '    </table>',
            '    <button id="toggle" type="button">Loss-free only</button>',
            '  </div>',
            '  <script>',
            '    const ships = [',
            '      { losses: 1, name: "Erebos", sorties: 12 },',
            '      { losses: 0, name: "Halcyon", sorties: 9 },',
            '      { losses: 2, name: "Vireo", sorties: 15 },',
            '    ];',
            '    let lossFreeOnly = false;',
            '    const body = document.getElementById("fleet");',
            '    function render() {',
            '      const rows = ships.filter((ship) => !lossFreeOnly || ship.losses === 0);',
            '      body.innerHTML = rows.map((ship) =>',
            "        '<tr><td>' + ship.name + '</td><td class=\"num\">' + ship.sorties + '</td>' +",
            '        \'<td><div class="bar" style="width:\' + ship.sorties * 6 + \'%"></div></td></tr>\'',
            '      ).join("");',
            '    }',
            '    document.getElementById("toggle").addEventListener("click", (event) => {',
            '      lossFreeOnly = !lossFreeOnly;',
            '      event.target.textContent = lossFreeOnly ? "Show all" : "Loss-free only";',
            '      render();',
            '    });',
            '    render();',
            '  </script>',
            '</body>',
            '</html>',
        ].join('\n'),
        path: 'workbench/demos/artifact.html',
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
