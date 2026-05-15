import { describe, expect, it } from 'bun:test';
import { mapOpenClawAgentFileContent, mapOpenClawAgentFileList } from './files.ts';

describe('OpenClaw agent file mapping', () => {
    it('normalizes listed agent files', () => {
        expect(
            mapOpenClawAgentFileList({
                files: [
                    { path: 'SOUL.md', sizeBytes: 12 },
                    { name: 'config/ROLE.md' },
                    'IDENTITY.md',
                ],
            }).files
        ).toEqual([
            {
                mediaType: null,
                path: 'SOUL.md',
                sizeBytes: 12,
                updatedAt: null,
            },
            {
                mediaType: null,
                path: 'config/ROLE.md',
                sizeBytes: null,
                updatedAt: null,
            },
            {
                mediaType: 'text/markdown',
                path: 'IDENTITY.md',
                sizeBytes: null,
                updatedAt: null,
            },
        ]);
    });

    it('normalizes file contents', () => {
        expect(
            mapOpenClawAgentFileContent({
                content: { content: '# Soul', path: 'SOUL.md' },
                path: 'fallback.md',
            })
        ).toMatchObject({
            content: '# Soul',
            path: 'SOUL.md',
        });
    });

    it('normalizes missing file contents to an empty document', () => {
        expect(
            mapOpenClawAgentFileContent({
                content: {
                    file: {
                        missing: true,
                        name: 'IDENTITY.md',
                        path: '/workspace/main/IDENTITY.md',
                    },
                },
                path: 'IDENTITY.md',
            })
        ).toMatchObject({
            content: '',
            path: '/workspace/main/IDENTITY.md',
        });
    });
});
