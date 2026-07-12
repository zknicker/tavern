import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { agentRuntimeMutationHeaders, agentRuntimeMutationOrigins } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { handleTimezoneSettingsRequest } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructions } from './agent-instructions.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat } from './chat-api/index.ts';

/**
 * PROMPT CONTRACT — read before editing this file or any prompt source.
 *
 * This suite is the executable requirements list for the composed agent
 * system prompt (managed instructions + memory/SOUL sections + the Tavern
 * chat section). Every entry in REQUIREMENTS names a capability agents
 * MUST keep being taught; the snapshots make every prompt edit reviewable
 * as a text diff; the budgets stop silent token growth.
 *
 * For AI assistants working in this repo:
 * - Never delete or weaken a requirement just to make this suite pass.
 *   A failing requirement means a capability was removed from the prompt —
 *   stop and confirm with the operator that the removal is intentional.
 * - When you change prompt text, show the operator the snapshot diff and
 *   get explicit confirmation before shipping.
 * - When you add a prompt-taught capability, add a requirement here in the
 *   same change.
 * See AGENTS.md ("Agent system prompt changes") and specs/agent-mentions.md.
 */
const REQUIREMENTS: Array<{
    absent?: true;
    capability: string;
    expected: RegExp | string;
    prompt: 'channel' | 'dm';
}> = [
    // Identity and durable memory surfaces.
    {
        capability: 'managed identity header',
        expected: '# Tavern Agent Instructions',
        prompt: 'channel',
    },
    { capability: 'SOUL identity section', expected: '## SOUL', prompt: 'channel' },
    {
        capability: 'core memory files taught',
        expected: '`USER.md` and `MEMORY.md` live in your workspace',
        prompt: 'channel',
    },
    // Chat identity: where the agent is, who else holds a seat.
    {
        capability: 'chat identity (channel)',
        expected: 'This is the "contract" channel.',
        prompt: 'channel',
    },
    {
        capability: 'chat identity (dm)',
        expected: 'a direct message between you and the user',
        prompt: 'dm',
    },
    { capability: 'chat id exposed', expected: '- chatId: cht_contract', prompt: 'channel' },
    {
        capability: 'co-agent roster with mention link and bio',
        expected: '- [Wren](agent://agt_wren) (agent) — Runs the Amazon Merch business.',
        prompt: 'channel',
    },
    { capability: 'own seat marked', expected: 'Otto (you)', prompt: 'channel' },
    // Timestamps and recall hygiene.
    {
        capability: 'timestamp staleness policy',
        expected: /send time in \S+ \(the home timezone\)/,
        prompt: 'channel',
    },
    {
        capability: 'wiki recall is background context',
        expected: 'Recalled Wiki blocks are automatic background context',
        prompt: 'channel',
    },
    // Channel discipline: silence and handoffs (channel-only teachings).
    {
        capability: 'NO_REPLY silent turn',
        expected: 'Reply with exactly NO_REPLY',
        prompt: 'channel',
    },
    {
        capability: 'agent handoff via mention in final reply',
        expected: 'mention its participant-list link in your final reply',
        prompt: 'channel',
    },
    { absent: true, capability: 'no NO_REPLY teaching in DMs', expected: 'NO_REPLY', prompt: 'dm' },
    // Tool surfaces taught in the prompt (schemas ship per turn; these lines
    // teach when to reach for them).
    {
        capability: 'current-chat history tools',
        expected: '- chat_messages_search: search current-chat messages',
        prompt: 'channel',
    },
    {
        capability: 'cross-chat inventory tool',
        expected: '- chats_list: list the chats you participate in',
        prompt: 'channel',
    },
    {
        capability: 'cross-chat post tool with confirmation rule',
        expected:
            '- chat_send: post a message into another chat you participate in (confirm with the user first)',
        prompt: 'channel',
    },
    {
        capability: 'wiki tools taught',
        expected: '- wiki_search: search shared Wiki pages',
        prompt: 'channel',
    },
];

// Character ceilings for the deterministic fixture (default SOUL, empty core
// memory). Raising one is a deliberate spend decision — confirm with the
// operator, do not just bump the number.
// Current: chat section ~1.6k chars, full fixture prompt ~12.4k chars.
const promptBudgets = {
    channelChatSection: 2000,
    channelTotal: 13_500,
};

describe('agent prompt contract', () => {
    let skillsDir: string;
    let workspaceDir: string;

    beforeEach(async () => {
        skillsDir = await mkdtemp(path.join(tmpdir(), 'tavern-prompt-skills-'));
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-prompt-workspace-'));
        ensureRuntimeSchema(initTestDb());
        await handleTimezoneSettingsRequest(
            new Request('http://runtime.test/timezone-settings', {
                body: JSON.stringify({ timezone: 'UTC' }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );
        seedContractChats();
    });

    afterEach(async () => {
        closeDb();
        await Promise.all([
            rm(skillsDir, { force: true, recursive: true }),
            rm(workspaceDir, { force: true, recursive: true }),
        ]);
    });

    it('keeps every prompt-taught capability present', async () => {
        const prompts = {
            channel: await renderPrompt('cht_contract'),
            dm: await renderPrompt('cht_contract_dm'),
        };

        const missing = REQUIREMENTS.filter((requirement) => {
            const prompt = prompts[requirement.prompt];
            const present =
                typeof requirement.expected === 'string'
                    ? prompt.includes(requirement.expected)
                    : requirement.expected.test(prompt);
            return requirement.absent ? present : !present;
        }).map((requirement) => requirement.capability);

        expect(missing, 'Prompt lost capabilities — see PROMPT CONTRACT header').toEqual([]);
    });

    it('matches the reviewed channel prompt snapshot', async () => {
        const prompt = normalize(await renderPrompt('cht_contract'), workspaceDir);
        await expect(prompt).toMatchFileSnapshot('./__prompt-snapshots__/channel-prompt.md');
    });

    it('matches the reviewed dm prompt snapshot', async () => {
        const prompt = normalize(await renderPrompt('cht_contract_dm'), workspaceDir);
        await expect(prompt).toMatchFileSnapshot('./__prompt-snapshots__/dm-prompt.md');
    });

    it('stays inside the prompt character budgets', async () => {
        const prompt = await renderPrompt('cht_contract');
        const chatSection = prompt.slice(prompt.indexOf('This chat:'));

        expect(chatSection.length).toBeLessThanOrEqual(promptBudgets.channelChatSection);
        expect(prompt.length).toBeLessThanOrEqual(promptBudgets.channelTotal);
    });

    async function renderPrompt(chatId: string) {
        return await buildAgentInstructions(executorInput(chatId, workspaceDir), {
            db: getDb(),
            skillsDir,
        });
    }
});

function seedContractChats() {
    upsertStoredAgent({
        agent: {
            bio: 'Runs the Amazon Merch business.',
            enabledSkillIds: [],
            id: 'agt_wren',
            isAdmin: false,
            name: 'Wren',
            primaryColor: null,
            workspaceFolder: '/tmp/agt_wren',
        },
    });
    const user = { id: 'usr_tavern', kind: 'user' as const, label: 'You', metadata: {} };
    const otto = {
        id: 'agt_primary',
        kind: 'agent' as const,
        label: 'Otto',
        metadata: { agentId: 'agt_primary' },
    };
    createChat({
        id: 'cht_contract',
        kind: 'channel',
        participants: [
            user,
            otto,
            { id: 'agt_wren', kind: 'agent', label: 'Wren', metadata: { agentId: 'agt_wren' } },
        ],
        title: 'contract',
    });
    createChat({
        id: 'cht_contract_dm',
        kind: 'dm',
        participants: [user, otto],
        title: 'Otto',
    });
}

function normalize(prompt: string, workspaceDir: string) {
    return `${prompt.replaceAll(workspaceDir, '<workspace>')}\n`;
}

function executorInput(chatId: string, workspaceFolder: string): AgentExecutorInput {
    const now = '2026-06-29T12:00:00.000Z';
    return {
        agent: {
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Otto',
            primaryColor: null,
            workspaceFolder,
        },
        agentSession: {
            agentId: 'agt_primary',
            agentParticipantId: 'agt_primary',
            archivedAt: null,
            chatId,
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: `ags_${chatId}_agt_primary_1`,
            promptContextSequence: 0,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        },
        attachments: [],
        chatId,
        content: 'contract fixture',
        requestMessageId: 'msg_contract',
        responseId: 'rsp_contract',
        runId: 'run_contract',
    };
}
