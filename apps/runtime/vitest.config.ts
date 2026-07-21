import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Mirror bun's `with { type: 'text' }` markdown imports (visuals skill
 * sources) for the vitest/vite pipeline: load .md files as default-exported
 * strings.
 */
export function markdownAsText(): Plugin {
    return {
        enforce: 'pre',
        load(id) {
            if (!id.endsWith('.md')) {
                return null;
            }
            return `export default ${JSON.stringify(fs.readFileSync(id, 'utf8'))};`;
        },
        name: 'tavern:markdown-as-text',
    };
}

export default defineConfig({
    plugins: [markdownAsText()],
    test: {
        env: {
            // Keep tests hermetic: no detected host Claude Code login.
            TAVERN_AGENT_CLAUDE_CODE_HOST_LOGIN: '0',
            // Keep tests out of the developer's real ~/.tavern runtime root.
            TAVERN_RUNTIME_ROOT: path.join(os.tmpdir(), 'tavern-runtime-vitest'),
        },
        include: ['src/**/*.test.ts'],
    },
});
