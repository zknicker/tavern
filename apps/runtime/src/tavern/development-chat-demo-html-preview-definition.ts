import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { widgetDemoRenderInput } from './development-chat-demo-basic-definitions';
import {
    activityRuntimeMetadata,
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

// Renders live from the seeded workspace file (see development-demos.ts in
// workspace/), so the widget shows the artifact-pane read path end to end.
export const htmlPreviewDemoWorkspacePath = 'workbench/demos/html-preview.html';

export function htmlPreviewDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.htmlPreview;
    const runId = 'run_demo_html_preview';
    const requestMessageId = 'msg_demo_html_preview_request';
    const responseMessageId = 'msg_demo_html_preview_response';
    const fallbackText = 'Starfield demo';

    return {
        chatId,
        title: 'Demo: HTML Preview Widget',
        messages: [
            userMessage({
                chatId,
                content: 'Build me a tiny animated demo page and show it inline.',
                id: requestMessageId,
                nonce: 'demo-html-preview-request',
            }),
            assistantMessage({
                chatId,
                content: 'Wrote a self-contained page in my workbench; preview below.',
                id: responseMessageId,
                nonce: 'demo-html-preview-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            {
                ...completedResponse({
                    chatId,
                    id: 'rsp_demo_html_preview',
                    requestMessageId,
                    responseMessageId,
                    runId,
                    summary: 'Rendered an html-preview widget demo.',
                }),
                activities: [
                    {
                        completed_at: demoTime,
                        detail: fallbackText,
                        id: 'act_demo_html_preview',
                        kind: 'widget',
                        metadata: {
                            runtime: activityRuntimeMetadata({
                                chatId,
                                id: 'act_demo_html_preview',
                                requestMessageId,
                                runId,
                                sequence: 1,
                                source: 'demo.widget',
                            }),
                            widget: widgetDemoRenderInput('html-preview', fallbackText, {
                                height: 360,
                                path: htmlPreviewDemoWorkspacePath,
                                title: 'Starfield demo',
                            }),
                        },
                        sequence: 1,
                        started_at: demoTime,
                        status: 'completed',
                        summary: fallbackText,
                        title: 'HTML preview',
                    },
                ],
            },
        ],
    };
}
