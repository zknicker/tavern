import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoAgentId,
    messageActivity,
    reasoningActivity,
    responseRuntimeMetadata,
    toolActivity,
    userMessage,
} from './development-chat-demo-types';

export function activityTurnDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.activityTurn;
    const runId = 'run_demo_activity_turn';
    const requestMessageId = 'msg_demo_activity_turn_request';
    const responseMessageId = 'msg_demo_activity_turn_response';

    return {
        chatId,
        title: 'Demo: Activity Turn',
        messages: [
            userMessage({
                chatId,
                content:
                    'Make the activity stream feel like the app, with visible progress and grouped tool work.',
                id: requestMessageId,
                nonce: 'demo-activity-turn-request',
            }),
            assistantMessage({
                chatId,
                content:
                    'Implemented the transcript layout. Visible progress updates render as assistant text, and work rows stay grouped by phase.',
                id: responseMessageId,
                nonce: 'demo-activity-turn-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_activity_turn',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Shows progress updates and tool activity in one turn.',
                }),
                activities: [
                    messageActivity({
                        chatId,
                        detail: "I'll split visible assistant progress from tool activity, then keep file work grouped between updates.",
                        id: 'act_demo_activity_turn_plan',
                        requestMessageId,
                        runId,
                        sequence: 1,
                    }),
                    toolActivity({
                        chatId,
                        id: 'act_demo_activity_turn_read',
                        requestMessageId,
                        runId,
                        sequence: 2,
                        title: 'Read chat transcript model',
                        toolArguments: {
                            path: 'apps/website/src/features/chats/chat-transcript-model.ts',
                        },
                        toolCallId: 'call_demo_activity_read',
                        toolName: 'read',
                    }),
                    toolActivity({
                        chatId,
                        id: 'act_demo_activity_turn_search',
                        requestMessageId,
                        runId,
                        sequence: 3,
                        title: 'rg activity grouping',
                        toolArguments: {
                            query: 'activity grouping apps/website/src/features/chats',
                        },
                        toolCallId: 'call_demo_activity_search',
                        toolName: 'bash',
                    }),
                    messageActivity({
                        chatId,
                        detail: 'The grouping boundary is clear now: progress updates stay visible, while adjacent work rows stay compact.',
                        id: 'act_demo_activity_turn_update',
                        requestMessageId,
                        runId,
                        sequence: 4,
                    }),
                    toolActivity({
                        chatId,
                        id: 'act_demo_activity_turn_tests',
                        requestMessageId,
                        runId,
                        sequence: 5,
                        title: 'bun test chat transcript',
                        toolArguments: {
                            command:
                                'bun test apps/website/src/features/chats/chat-transcript.test.tsx',
                        },
                        toolCallId: 'call_demo_activity_tests',
                        toolName: 'bash',
                        toolResult: { status: 'passed' },
                    }),
                ],
            },
        ],
    };
}

export function streamingStackDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.streamingStack;
    const runId = 'run_demo_streaming_stack';
    const requestMessageId = 'msg_demo_streaming_stack_request';

    return {
        chatId,
        title: 'Demo: Streaming Stack',
        messages: [
            userMessage({
                chatId,
                content:
                    'Check the deployment notes, run whatever tools you need, and report any high-risk security findings clearly.',
                id: requestMessageId,
                nonce: 'demo-streaming-stack-request',
            }),
        ],
        responses: [
            {
                id: 'rsp_demo_streaming_stack',
                metadata: responseRuntimeMetadata({ chatId, requestMessageId, runId }),
                participant_id: demoAgentId,
                request_message_id: requestMessageId,
                response_message_id: null,
                status: 'cancelled',
                summary: 'Agent response stopped.',
                activities: [
                    reasoningActivity({
                        chatId,
                        detail: '**Planning the pass** I need to inspect release notes, run a terminal check, then pause on any high-risk scan result.',
                        id: 'act_demo_streaming_stack_thinking',
                        requestMessageId,
                        runId,
                        sequence: 1,
                    }),
                    messageActivity({
                        chatId,
                        detail: "I'll verify the release note wording first, then run the local security scan before changing anything.",
                        id: 'act_demo_streaming_stack_update',
                        requestMessageId,
                        runId,
                        sequence: 2,
                    }),
                    toolActivity({
                        chatId,
                        id: 'act_demo_streaming_stack_read',
                        requestMessageId,
                        runId,
                        sequence: 3,
                        title: 'Read release notes',
                        toolArguments: { path: 'docs/operations/releases.md' },
                        toolCallId: 'call_demo_streaming_read',
                        toolName: 'read',
                    }),
                    toolActivity({
                        chatId,
                        id: 'act_demo_streaming_stack_scan',
                        requestMessageId,
                        runId,
                        sequence: 4,
                        title: 'bun run scan:hosts',
                        toolArguments: { command: 'bun run scan:hosts' },
                        toolCallId: 'call_demo_streaming_scan',
                        toolName: 'bash',
                        toolResult: { severity: 'high', status: 'blocked' },
                    }),
                ],
            },
        ],
    };
}
