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
