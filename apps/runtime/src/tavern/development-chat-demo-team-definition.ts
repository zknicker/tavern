import { developmentChatTeamDemoId } from '@tavern/api/development-chat-demos';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoAgentId,
    demoSecondAgentId,
    demoTime,
    ownerMessage,
    toolActivity,
} from './development-chat-demo-types';

// Multi-agent demo: two agent seats answering the same request in one
// channel. Exercises the roster facepile, per-seat turn identity, and the
// venue for the dev toolkit's multi-agent simulated turn.
export function teamDemo(): DevelopmentChatDemo {
    const chatId = developmentChatTeamDemoId;
    const requestMessageId = 'msg_demo_team_request';
    const ottoRunId = 'run_msg_demo_team_otto_reply';
    const wrenRunId = 'run_msg_demo_team_wren_reply';

    return {
        agentIds: [demoAgentId, demoSecondAgentId],
        chatId,
        color: '#8b5cf6',
        title: 'team demo',
        messages: [
            ownerMessage({
                chatId,
                content:
                    'Team check: Otto, what shipped this week? Wren, anything risky in the queue?',
                createdAt: demoTime,
                id: requestMessageId,
                nonce: 'demo-team-request',
            }),
            assistantMessage({
                chatId,
                content:
                    'Shipped this week: the send-anchor scroll fix, per-seat turn identity, and the drawer-based work evidence. Release notes are drafted in the workspace.',
                createdAt: offsetDemoTime(90),
                id: 'msg_demo_team_otto_reply',
                nonce: 'demo-team-otto-reply',
                requestMessageId,
                runId: ottoRunId,
            }),
            assistantMessage({
                agentId: demoSecondAgentId,
                chatId,
                content:
                    'Two risky items in the queue: the runtime schema change needs a fresh-database pass, and the calendar plugin token expires Friday. Both are flagged.',
                createdAt: offsetDemoTime(150),
                id: 'msg_demo_team_wren_reply',
                nonce: 'demo-team-wren-reply',
                requestMessageId,
                runId: wrenRunId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_team_otto',
                    requestMessageId,
                    responseMessageId: 'msg_demo_team_otto_reply',
                    runId: ottoRunId,
                    summary: 'Summarized the week of shipping.',
                }),
                activities: [
                    toolActivity({
                        chatId,
                        id: `act_${ottoRunId}_tool_1`,
                        requestMessageId,
                        runId: ottoRunId,
                        sequence: 1,
                        title: 'git log --since="1 week"',
                        toolArguments: { command: 'git log --since="1 week" --oneline' },
                        toolCallId: `${ottoRunId}_t1`,
                        toolName: 'exec',
                    }),
                ],
            },
            {
                ...completedResponse({
                    agentId: demoSecondAgentId,
                    chatId,
                    id: 'rsp_demo_team_wren',
                    requestMessageId,
                    responseMessageId: 'msg_demo_team_wren_reply',
                    runId: wrenRunId,
                    summary: 'Flagged the risky queue items.',
                }),
                activities: [
                    toolActivity({
                        agentId: demoSecondAgentId,
                        chatId,
                        id: `act_${wrenRunId}_tool_1`,
                        requestMessageId,
                        runId: wrenRunId,
                        sequence: 1,
                        title: 'Read QUEUE.md',
                        toolArguments: { path: 'QUEUE.md' },
                        toolCallId: `${wrenRunId}_t1`,
                        toolName: 'read_file',
                    }),
                    {
                        completed_at: demoTime,
                        detail: 'Cross-checking token expiry against the plugin settings.',
                        id: `act_${wrenRunId}_msg_1`,
                        kind: 'message',
                        metadata: {
                            runtime: {
                                ...activityRuntimeMetadata({
                                    agentId: demoSecondAgentId,
                                    chatId,
                                    id: `act_${wrenRunId}_msg_1`,
                                    requestMessageId,
                                    runId: wrenRunId,
                                    sequence: 2,
                                }),
                                messagePhase: 'commentary',
                            },
                        },
                        sequence: 2,
                        started_at: demoTime,
                        status: 'completed',
                        summary: 'Cross-checking token expiry against the plugin settings.',
                        title: 'Assistant update',
                    },
                ],
            },
        ],
    };
}

function offsetDemoTime(seconds: number) {
    return new Date(Date.parse(demoTime) + seconds * 1000).toISOString();
}
