import fs from 'node:fs';
import path from 'node:path';
import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import { AGENT_WORKSPACE } from '../config';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { resolveSemanticMemoryConfigSync } from '../memory/semantic/store';
import { ensureCurrentAgentSession } from './agent-session-store';
import {
    completeAgentTurn,
    createAgentTurn,
    recordAgentTurnPromptEvidence,
} from './agent-turn-store';
import { getMessage } from './chat-api';
import { demoAgentId } from './development-chat-demo-types';

/**
 * Dev-stack-only recall demo data: a few Semantic Memory pages plus prompt
 * evidence on the newest #demo turns, so the turn drawer's Recalled Memory
 * section and dev-mode prompt blob render without a live model turn.
 */

const demoMemoryPages = [
    {
        body: [
            '---',
            'summary: Chart widgets available in Tavern demo dashboards',
            'tags: [charts, widgets, demo]',
            '---',
            '# Demo Dashboard Widgets',
            '',
            'The demo dashboard uses line, bar, and composed chart widgets.',
            'Prefer composed charts when a question mixes units and revenue.',
        ].join('\n'),
        relativePath: 'projects/demo-dashboard.md',
        summary: 'Chart widgets available in Tavern demo dashboards',
        title: 'Demo Dashboard Widgets',
    },
    {
        body: [
            '---',
            'summary: Demo user preferences for charts and readouts',
            'tags: [preferences, demo]',
            '---',
            '# Demo User Preferences',
            '',
            'The demo user prefers compact readouts with source-backed numbers',
            'and a chart whenever the question is about trends.',
        ].join('\n'),
        relativePath: 'people/demo-user.md',
        summary: 'Demo user preferences for charts and readouts',
        title: 'Demo User Preferences',
    },
];

export function seedDevelopmentRecallEvidence(db: Database) {
    seedDemoMemoryPages();

    const responses = db
        .prepare(
            `SELECT id, request_message_id
             FROM chat_responses
             WHERE chat_id = $chatId
               AND request_message_id IS NOT NULL
               AND id LIKE 'rsp_demo_%'
             ORDER BY created_at DESC
             LIMIT 2`
        )
        .all(namedParams({ chatId: developmentChatDemoId })) as Array<{
        id: string;
        request_message_id: string;
    }>;
    if (responses.length === 0) {
        return;
    }

    // A bare agents row satisfies the agent-session foreign key without the
    // agent-store side effects (a stored agent gets its own DM chat).
    db.prepare(
        `INSERT INTO agents
            (id, name, primary_color, workspace_folder, enabled_skill_ids_json, is_admin, raw_json, last_synced_at, created_at, updated_at)
         VALUES ($id, 'Tavern', NULL, $workspaceFolder, '[]', 0, '{}', $now, $now, $now)
         ON CONFLICT(id) DO NOTHING`
    ).run(
        namedParams({
            id: demoAgentId,
            now: new Date().toISOString(),
            workspaceFolder: AGENT_WORKSPACE,
        })
    );
    const session = ensureCurrentAgentSession({
        agentParticipantId: demoAgentId,
        chatId: developmentChatDemoId,
        db,
    });

    for (const response of responses) {
        const runId = response.id.replace(/^rsp_/, 'run_');
        const request = getMessage(response.request_message_id, db);
        createAgentTurn(
            {
                agentId: demoAgentId,
                agentParticipantId: demoAgentId,
                agentSessionId: session.id,
                chatId: developmentChatDemoId,
                id: runId,
                metadata: { trigger: 'message' },
                responseId: response.id,
                triggerMessageId: response.request_message_id,
            },
            db
        );
        completeAgentTurn({ activityIds: [], id: runId, outputMessageIds: [] }, db);
        recordAgentTurnPromptEvidence(
            {
                evidence: {
                    capturedAt: new Date().toISOString(),
                    instructions:
                        '# Tavern Agent Instructions (demo)\n\nYou are Tavern, the demo agent. Static chat guidance and tool descriptions live here.',
                    prompt: demoPrompt(request?.content ?? 'Show the demo.'),
                    recall: demoMemoryPages.map((page, index) => ({
                        path: page.relativePath,
                        score: 0.58 - index * 0.17,
                        snippet: page.summary,
                        title: page.title,
                    })),
                },
                id: runId,
            },
            db
        );
    }
}

function demoPrompt(requestContent: string) {
    const recallLines = demoMemoryPages
        .map((page) => `- ${page.title} [${page.relativePath}]: ${page.summary}`)
        .join('\n');
    return [
        'This turn:',
        `- current time: ${new Date().toISOString()}`,
        '',
        'Recalled Memory:',
        recallLines,
        '',
        'New message for Tavern:',
        requestContent,
    ].join('\n');
}

function seedDemoMemoryPages() {
    const memoryRoot = resolveSemanticMemoryConfigSync().memoryPath;
    for (const page of demoMemoryPages) {
        const pagePath = path.join(memoryRoot, page.relativePath);
        if (fs.existsSync(pagePath)) {
            continue;
        }
        fs.mkdirSync(path.dirname(pagePath), { recursive: true });
        fs.writeFileSync(pagePath, `${page.body}\n`);
    }
}
