import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { listStoredAgents } from '../tavern/agents-store';
import {
    getStoredOpenClawModels,
    listStoredOpenClawSkills,
} from '../tavern/openclaw-snapshots-store';
import { createLocalOpenClawClient } from './local-client';
import { syncManagedOpenClawSnapshots } from './snapshot-sync';

vi.mock('./local-client', () => ({
    createLocalOpenClawClient: vi.fn(),
}));

describe('Managed OpenClaw snapshot sync', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        closeDb();
    });

    test('syncs startup reference snapshots for models and skills', async () => {
        mockLocalOpenClawClient({
            close: vi.fn(),
            getModels: vi.fn(async () => ({
                models: [{ id: 'gpt-5.5', label: 'GPT-5.5', provider: 'openai' }],
                updatedAt: '2026-06-02T20:00:00.000Z',
            })),
            listAgents: vi.fn(async () => ({ agents: [] })),
            listSkills: vi.fn(async () => ({
                skills: [
                    {
                        allowedTools: null,
                        configChecks: [],
                        description: 'Browser skill',
                        id: 'browser',
                        install: [],
                        missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
                        name: 'Browser',
                        requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
                        source: 'builtin',
                        updatedAt: null,
                    },
                ],
            })),
        });

        const result = await syncManagedOpenClawSnapshots({ publishEvents: false });

        expect(result).toMatchObject({
            models: 1,
            skills: 1,
        });
        expect(getStoredOpenClawModels().models).toHaveLength(1);
        expect(listStoredOpenClawSkills().skills).toHaveLength(1);
    });

    test('keeps agent startup sync independent from model and skill snapshots', async () => {
        mockLocalOpenClawClient({
            close: vi.fn(),
            getModels: vi.fn(async () => {
                throw new Error('models unavailable');
            }),
            listAgents: vi.fn(async () => ({
                agents: [
                    {
                        avatar: null,
                        enabledSkillIds: [],
                        emoji: null,
                        id: 'main',
                        isAdmin: false,
                        name: 'Main',
                        primaryColor: null,
                        workspaceFolder: '/tmp/main',
                    },
                ],
            })),
            listSkills: vi.fn(async () => {
                throw new Error('skills unavailable');
            }),
        });

        const result = await syncManagedOpenClawSnapshots({ publishEvents: false });

        expect(result).toMatchObject({
            agents: 1,
            models: 0,
            skills: 0,
        });
        expect(listStoredAgents().agents).toHaveLength(1);
    });
});

function mockLocalOpenClawClient(client: unknown) {
    (
        createLocalOpenClawClient as unknown as {
            mockReturnValue(value: ReturnType<typeof createLocalOpenClawClient>): void;
        }
    ).mockReturnValue(client as ReturnType<typeof createLocalOpenClawClient>);
}
