import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { ensureCurrentAgentSession } from '../tavern/agent-session-store.ts';
import { claimNextAgentTurnForAgent, createAgentTurn } from '../tavern/agent-turn-store.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, createMessage, upsertResponse } from '../tavern/chat-api/index.ts';
import {
    processSkillCurator,
    resetSkillCuratorForTesting,
    setSkillCuratorSkillsDirForTesting,
    shouldRunSkillCurator,
} from './curator.ts';
import {
    clearLastCurationAt,
    configureDeepCuratorModel,
    readCurationJobs,
    setSkillState,
    writeLastCurationAt,
} from './curator-test-helpers.ts';
import {
    type ModelToolCall,
    modelResult,
    runModelTool,
    unwrapToolOutput,
} from './review-test-helpers.ts';
import { createAgentSkill } from './store.ts';

vi.mock('ai', () => ({
    generateText: vi.fn(),
    stepCountIs: (count: number) => ({ count }),
    tool: <T>(definition: T) => definition,
}));

const generateTextMock = vi.mocked(generateText);

describe('skill curator', () => {
    let skillsDir: string;
    let workspace: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-curator-skills-'));
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-curator-workspace-'));
        ensureRuntimeSchema(initTestDb());
        generateTextMock.mockReset();
        configureDeepCuratorModel();
        seedAgent();
        setSkillCuratorSkillsDirForTesting(skillsDir);
    });

    afterEach(async () => {
        resetSkillCuratorForTesting();
        vi.restoreAllMocks();
        closeDb();
        await fs.rm(skillsDir, { force: true, recursive: true });
        await fs.rm(workspace, { force: true, recursive: true });
    });

    test('assembles curation report from tool calls', async () => {
        await createSkill('Umbrella Skill', '# Umbrella Skill\n\nDo broad work.');
        await createSkill('Narrow Sibling', '# Narrow Sibling\n\nDo one narrow thing.');
        await createSkill('Stale Artifact', '# Stale Artifact\n\nOne-off task.');
        setSkillState('stale-artifact', 'stale');
        generateTextMock.mockImplementationOnce(async (config) => {
            const calls: ModelToolCall[] = [];
            const view = await runModelTool(config, calls, 'skill_view', {
                skillId: 'umbrella-skill',
            });
            const viewed = unwrapToolOutput(view) as { content: string; hash: string };
            await runModelTool(config, calls, 'skill_patch', {
                content: `${viewed.content}\n\n## Narrow sibling\n\nDo one narrow thing.`,
                expectedHash: viewed.hash,
                skillId: 'umbrella-skill',
            });
            await runModelTool(config, calls, 'skill_write_file', {
                content: 'Archived sibling details.',
                expectedHash: null,
                filePath: 'references/narrow-sibling.md',
                skillId: 'umbrella-skill',
            });
            await runModelTool(config, calls, 'skill_archive', {
                absorbedInto: 'umbrella-skill',
                reason: 'Merged sibling content into the umbrella skill.',
                skillId: 'narrow-sibling',
            });
            await runModelTool(config, calls, 'skill_archive', {
                absorbedInto: null,
                reason: 'Stale one-off artifact no longer belongs in the library.',
                skillId: 'stale-artifact',
            });
            return modelResult({
                calls,
                text: 'Consolidated one sibling and pruned one artifact.',
            });
        });

        await expect(
            processSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })
        ).resolves.toEqual({ completed: 1, skipped: 0 });

        const [job] = readCurationJobs();
        expect(job).toMatchObject({
            kind: 'curation',
            model_category: 'deep',
            status: 'completed',
        });
        expect(job.agent_id).toBe('agt_primary');
        expect(JSON.parse(job.metadata_json)).toMatchObject({
            consolidations: [
                {
                    from: 'narrow-sibling',
                    into: 'umbrella-skill',
                    reason: 'Merged sibling content into the umbrella skill.',
                },
            ],
            patches: [{ path: 'SKILL.md', skillId: 'umbrella-skill' }],
            prunings: [
                {
                    name: 'stale-artifact',
                    reason: 'Stale one-off artifact no longer belongs in the library.',
                },
            ],
            report: { text: 'Consolidated one sibling and pruned one artifact.' },
            writes: [{ path: 'references/narrow-sibling.md', skillId: 'umbrella-skill' }],
        });
        expect(JSON.parse(job.file_changes_json)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: 'umbrella-skill/SKILL.md' }),
                expect.objectContaining({ path: 'umbrella-skill/references/narrow-sibling.md' }),
            ])
        );
        await expect(
            fs.stat(path.join(skillsDir, '.archive', 'narrow-sibling'))
        ).resolves.toBeTruthy();
        await expect(
            fs.stat(path.join(skillsDir, '.archive', 'stale-artifact'))
        ).resolves.toBeTruthy();
    });

    test('skips without a model call when fewer than two active agent skills exist', async () => {
        await createSkill('Solo Skill', '# Solo Skill\n\nDo work.');

        await expect(
            processSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })
        ).resolves.toEqual({ completed: 0, skipped: 1 });

        expect(generateTextMock).not.toHaveBeenCalled();
        const [job] = readCurationJobs();
        expect(job).toMatchObject({ kind: 'curation', status: 'skipped' });
        expect(JSON.parse(job.metadata_json)).toMatchObject({
            reason: 'fewer than 2 active agent-created skills',
        });
    });

    test('idle and cadence gates block runs', () => {
        expect(shouldRunSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })).toMatchObject({
            ok: true,
        });

        writeLastCurationAt('2026-07-07T00:00:00.000Z');
        expect(shouldRunSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })).toMatchObject({
            ok: false,
            reason: 'curation ran less than 7 days ago',
        });

        clearLastCurationAt();
        createRunningTurn();
        expect(shouldRunSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })).toMatchObject({
            ok: false,
            reason: 'runtime has a running agent turn',
        });

        getDb().prepare("UPDATE agent_turns SET status = 'completed'").run();
        getDb()
            .prepare(
                `INSERT INTO skill_review_queue (
                    agent_id, chat_id, signals_json, attempts,
                    scheduled_for, created_at, updated_at
                 )
                 VALUES (
                    'agt_primary', 'cht_curator', '[]', 0,
                    '2026-07-08T00:00:00.000Z',
                    '2026-07-08T00:00:00.000Z',
                    '2026-07-08T00:00:00.000Z'
                 )`
            )
            .run();
        expect(shouldRunSkillCurator({ now: new Date('2026-07-08T00:00:00.000Z') })).toMatchObject({
            ok: false,
            reason: 'skill review queue is not empty',
        });
    });

    async function createSkill(name: string, content: string) {
        return await createAgentSkill({
            agentId: 'agt_primary',
            content,
            description: name,
            name,
            skillsDir,
        });
    }

    function seedAgent() {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: true,
                name: 'Tavern',
                primaryColor: null,
                workspaceFolder: workspace,
            },
            syncedAt: '2026-07-01T00:00:00.000Z',
        });
        createChat({
            id: 'cht_curator',
            kind: 'channel',
            participants: [
                { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
                {
                    id: 'agt_primary',
                    kind: 'agent',
                    label: 'Tavern',
                    metadata: { agentId: 'agt_primary' },
                },
            ],
            title: 'Curator',
        });
    }

    function createRunningTurn() {
        createMessage('cht_curator', {
            author_id: 'usr_tavern',
            content: 'Run',
            id: 'msg_curator',
            role: 'user',
        });
        upsertResponse('cht_curator', {
            id: 'rsp_curator',
            participant_id: 'agt_primary',
            request_message_id: 'msg_curator',
            status: 'running',
        });
        const session = ensureCurrentAgentSession({ agentId: 'agt_primary' });
        createAgentTurn({
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            agentSessionId: session.id,
            chatId: 'cht_curator',
            id: 'run_curator',
            responseId: 'rsp_curator',
            triggerMessageId: 'msg_curator',
        });
        claimNextAgentTurnForAgent({ agentId: 'agt_primary' });
    }
});
