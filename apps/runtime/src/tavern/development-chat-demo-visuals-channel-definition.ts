import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { widgetDemoRenderInput } from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    type DevelopmentDemoMessage,
    demoTime,
    userMessage,
} from './development-chat-demo-types';
import { visualDemoTurns } from './development-chat-demo-visuals-definition';

/**
 * Visuals gallery channel: one completed turn per rendered visual, closing
 * with the artifact card and the legacy-widget fallback state. A focused
 * surface for eyeballing generative output without the mixed demo content in
 * the main demo channel.
 */

// The artifact card opens this seeded workspace file (see development-demos.ts
// in workspace/) in the artifact pane's sandboxed HTML preview with host
// tokens injected.
export const artifactDemoWorkspacePath = 'workbench/demos/artifact.html';
export function visualsChannelDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.visuals;
    const turns = widgetTurns().map((turn) => widgetTurn(chatId, turn));

    return {
        chatId,
        color: '#8b5cf6',
        messages: turns
            .flatMap((turn) => turn.messages)
            .map((message, index) => ({
                ...message,
                createdAt: new Date(Date.parse(demoTime) + index * 45_000).toISOString(),
            })),
        responses: turns.flatMap((turn) => turn.responses),
        title: 'visuals',
    };
}

interface WidgetTurnSpec {
    reply: string;
    request: string;
    slug: string;
    widgets: {
        fallbackText: string;
        title: string;
        widget: Record<string, unknown>;
    }[];
}

function widgetTurns(): WidgetTurnSpec[] {
    return [
        ...visualDemoTurns(),
        {
            reply: 'The report is in the artifact pane.',
            request: 'Build the fleet status report as a page I can keep.',
            slug: 'artifact',
            widgets: [
                {
                    fallbackText: 'Fleet status',
                    title: 'Artifact',
                    widget: widgetDemoRenderInput('artifact', 'Fleet status', {
                        path: artifactDemoWorkspacePath,
                        title: 'Fleet status',
                    }),
                },
            ],
        },
        {
            reply: 'This row is a retired catalog widget, so the fallback card renders instead.',
            request: 'Replay a chat row from a retired widget.',
            slug: 'fallback',
            widgets: [
                {
                    fallbackText: 'Quarterly revenue',
                    title: 'Bar chart',
                    // Intentionally a retired component id: seeds the
                    // stored-payload degrade path so the gallery shows how
                    // pre-retirement history replays.
                    widget: {
                        component: 'tavern.widget.bar-chart',
                        fallback: { text: 'Quarterly revenue' },
                        props: {},
                        target: 'chat.inline',
                    },
                },
            ],
        },
    ];
}

function widgetTurn(
    chatId: string,
    spec: WidgetTurnSpec
): {
    messages: DevelopmentDemoMessage[];
    responses: DevelopmentChatDemo['responses'];
} {
    const runId = `run_demo_visuals_${spec.slug}`;
    const requestMessageId = `msg_demo_visuals_${spec.slug}_request`;
    const responseMessageId = `msg_demo_visuals_${spec.slug}_response`;

    return {
        messages: [
            userMessage({
                chatId,
                content: spec.request,
                id: requestMessageId,
                nonce: `demo-visuals-${spec.slug}-request`,
            }),
            assistantMessage({
                chatId,
                content: spec.reply,
                id: responseMessageId,
                nonce: `demo-visuals-${spec.slug}-response`,
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: `rsp_demo_visuals_${spec.slug}`,
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: spec.reply,
                }),
                activities: spec.widgets.map((entry, index) => ({
                    completed_at: demoTime,
                    detail: entry.fallbackText,
                    id: `act_demo_visuals_${spec.slug}_${index + 1}`,
                    kind: 'widget' as const,
                    metadata: {
                        runtime: activityRuntimeMetadata({
                            chatId,
                            id: `act_demo_visuals_${spec.slug}_${index + 1}`,
                            requestMessageId,
                            runId,
                            sequence: index + 1,
                            source: 'demo.widget',
                        }),
                        widget: entry.widget,
                    },
                    sequence: index + 1,
                    started_at: demoTime,
                    status: 'completed' as const,
                    summary: entry.fallbackText,
                    title: entry.title,
                })),
            },
        ],
    };
}
