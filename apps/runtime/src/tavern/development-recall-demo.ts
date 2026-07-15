import fs from 'node:fs';
import path from 'node:path';
import { developmentChatDemoId } from '@tavern/api/development-chat-demos';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { resolveWikiConfigSync } from '../wiki/store';
import {
    completeAgentTurn,
    createAgentTurn,
    recordAgentTurnPromptEvidence,
} from './agent-turn-store';
import { getMessage } from './chat-api';
import { demoAgentId } from './development-chat-demo-types';

/**
 * Dev-stack-only recall demo data: a few Wiki pages plus prompt
 * evidence on the newest #demo turns, so the turn drawer's Recalled Wiki
 * section and dev-mode prompt blob render without a live model turn.
 */

const demoWikiPages = [
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
    seedDemoWikiPages();

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

    // Reuse the newest demo-seeded Agent session so evidence turns share the
    // agent-drawer lineage instead of minting an extra session row.
    const session = db
        .prepare(
            `SELECT id FROM agent_sessions
             WHERE agent_id = $agentId
             ORDER BY generation DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId: demoAgentId })) as { id: string } | undefined;
    if (!session) {
        return;
    }

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
                        '# Tavern Agent Instructions (demo)\n\nYou are Otto, the demo agent. Static chat guidance and tool descriptions live here.',
                    prompt: demoPrompt(request?.content ?? 'Show the demo.'),
                    recall: demoWikiPages.map((page, index) => ({
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
    const recallLines = demoWikiPages
        .map((page) => `- ${page.title} [${page.relativePath}]: ${page.summary}`)
        .join('\n');
    return [
        'This turn:',
        `- current time: ${new Date().toISOString()}`,
        '',
        'Recalled Wiki:',
        recallLines,
        '',
        'New message for Tavern:',
        requestContent,
    ].join('\n');
}

function seedDemoWikiPages() {
    const wikiRoot = resolveWikiConfigSync().wikiPath;
    for (const page of demoWikiPages) {
        const pagePath = path.join(wikiRoot, page.relativePath);
        if (fs.existsSync(pagePath)) {
            continue;
        }
        fs.mkdirSync(path.dirname(pagePath), { recursive: true });
        fs.writeFileSync(pagePath, `${page.body}\n`);
    }
}
