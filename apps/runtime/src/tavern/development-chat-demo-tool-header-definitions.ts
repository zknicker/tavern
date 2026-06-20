import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoAgentId,
    demoTime,
    messageActivity,
    responseRuntimeMetadata,
    toolActivity,
    userMessage,
} from './development-chat-demo-types';

export function toolHeadersDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.toolHeaders;
    const completedRunId = 'run_demo_tool_headers_completed';
    const liveRunId = 'run_demo_tool_headers_live';
    const completedRequestMessageId = 'msg_demo_tool_headers_request';
    const completedResponseMessageId = 'msg_demo_tool_headers_response';
    const liveRequestMessageId = 'msg_demo_tool_headers_live_request';

    return {
        chatId,
        title: 'Demo: Tool Header Summaries',
        messages: [
            userMessage({
                chatId,
                content:
                    'Show me how collapsed tool drawers summarize mixed work without flashing raw tool names.',
                id: completedRequestMessageId,
                nonce: 'demo-tool-headers-request',
            }),
            assistantMessage({
                chatId,
                content:
                    'Here are the settled examples: file work groups collapse to stable summaries, data-prep tools stay generic, and decision tools avoid echoing raw commands.',
                id: completedResponseMessageId,
                nonce: 'demo-tool-headers-response',
                requestMessageId: completedRequestMessageId,
                runId: completedRunId,
            }),
            userMessage({
                chatId,
                content: 'Now show the live header behavior while work is still running.',
                id: liveRequestMessageId,
                nonce: 'demo-tool-headers-live-request',
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_tool_headers_completed',
                    requestMessageId: completedRequestMessageId,
                    responseMessageId: completedResponseMessageId,
                    runId: completedRunId,
                    summary: 'Shows settled work-drawer summary copy.',
                }),
                activities: completedToolHeaderActivities({
                    chatId,
                    requestMessageId: completedRequestMessageId,
                    runId: completedRunId,
                }),
            },
            {
                id: 'rsp_demo_tool_headers_live',
                metadata: responseRuntimeMetadata({
                    chatId,
                    requestMessageId: liveRequestMessageId,
                    runId: liveRunId,
                }),
                participant_id: demoAgentId,
                request_message_id: liveRequestMessageId,
                response_message_id: null,
                status: 'running',
                summary: '',
                activities: liveToolHeaderActivities({
                    chatId,
                    requestMessageId: liveRequestMessageId,
                    runId: liveRunId,
                }),
            },
        ],
    };
}

function completedToolHeaderActivities(input: DemoToolHeaderActivityInput) {
    return [
        messageActivity({
            ...input,
            detail: 'First I am grouping file reads with a code search so the collapsed drawer says what kind of work happened.',
            id: 'act_demo_tool_headers_file_intro',
            sequence: 1,
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_read_chat',
            sequence: 2,
            title: 'docs/features/chat.md',
            toolArguments: { path: 'docs/features/chat.md' },
            toolCallId: 'call_demo_tool_headers_read_chat',
            toolName: 'read_file',
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_read_tool_presentation',
            sequence: 3,
            title: 'docs/internals/tool-presentation.md',
            toolArguments: { path: 'docs/internals/tool-presentation.md' },
            toolCallId: 'call_demo_tool_headers_read_tool_presentation',
            toolName: 'read_file',
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_search',
            sequence: 4,
            title: 'tool header summary',
            toolArguments: { query: 'tool header summary' },
            toolCallId: 'call_demo_tool_headers_search',
            toolName: 'search_files',
        }),
        messageActivity({
            ...input,
            detail: 'Next I am grouping data-prep tools so the collapsed drawer reads as normal tool work.',
            id: 'act_demo_tool_headers_data_intro',
            sequence: 5,
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_read_sales',
            sequence: 6,
            title: 'sales-summary.json',
            toolArguments: {
                path: 'sales-summary.json',
            },
            toolCallId: 'call_demo_tool_headers_read_sales',
            toolName: 'read_file',
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_search_sales',
            sequence: 7,
            title: 'sales anomaly notes',
            toolArguments: {
                query: 'sales anomaly notes',
            },
            toolCallId: 'call_demo_tool_headers_search_sales',
            toolName: 'search_files',
        }),
        messageActivity({
            ...input,
            detail: 'Finally, a completed approval row keeps the drawer details available while the collapsed header uses decision-language.',
            id: 'act_demo_tool_headers_decision_intro',
            sequence: 8,
        }),
        approvalActivity(input),
    ];
}

function liveToolHeaderActivities(input: DemoToolHeaderActivityInput) {
    return [
        messageActivity({
            ...input,
            detail: 'I am starting with code search, then a running command. The collapsed header stays on the stable summary instead of flashing the raw command.',
            id: 'act_demo_tool_headers_live_intro',
            sequence: 1,
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_live_search',
            sequence: 2,
            title: 'tool header latch',
            toolArguments: { query: 'tool header latch' },
            toolCallId: 'call_demo_tool_headers_live_search',
            toolName: 'search_files',
        }),
        toolActivity({
            ...input,
            id: 'act_demo_tool_headers_live_command',
            sequence: 3,
            status: 'running',
            title: 'bun test apps/website/src/features/chats/chat-transcript-activity-utils.test.ts',
            toolArguments: {
                command:
                    'bun test apps/website/src/features/chats/chat-transcript-activity-utils.test.ts',
            },
            toolCallId: 'call_demo_tool_headers_live_command',
            toolName: 'terminal',
        }),
    ];
}

function approvalActivity(input: DemoToolHeaderActivityInput) {
    const command = "python3 - <<'PY'\nprint('header summaries stay calm')\nPY";

    return {
        completed_at: demoTime,
        id: 'act_demo_tool_headers_approval',
        kind: 'approval' as const,
        metadata: {
            approval: {
                command,
                description: 'run a generated verification snippet',
                patternKey: 'demo:tool-header-approval',
                patternKeys: ['demo:tool-header-approval'],
            },
            runtime: activityRuntimeMetadata({
                ...input,
                id: 'act_demo_tool_headers_approval',
                sequence: 9,
                toolCallId: 'call_demo_tool_headers_approval',
                toolName: 'approval',
            }),
            tool: {
                arguments: {
                    command,
                    reason: 'run a generated verification snippet',
                },
                name: 'approval',
                result: { decision: 'approved' },
            },
        },
        sequence: 9,
        started_at: demoTime,
        status: 'completed' as const,
        summary: 'Run generated verification snippet',
        title: 'Run generated verification snippet',
    };
}

interface DemoToolHeaderActivityInput {
    chatId: string;
    requestMessageId: string;
    runId: string;
}
