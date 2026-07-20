import {
    type WidgetName,
    type WidgetRenderInput,
    widgetComponentId,
    widgetRenderInputSchema,
} from '@tavern/api';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    ownerMessage,
    userMessage,
} from './development-chat-demo-types';

const longPastedOAuthJson =
    '{"installed":{"client_id":"535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com","project_id":"tavern-static-preview","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"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cret","redirect_uris":["http://localhost"]}}';
const longOAuthConsentUrl =
    'https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=535034123734-jckkmfjk3qajgeo8mhcstmtkbdrt0gn2.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A1&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events.readonly&access_type=offline&prompt=consent&state=tavern_static_preview_long_agent_response_token';

export function artifactLinksDemo(): DevelopmentChatDemo {
    return completedTextDemo({
        chatId: developmentChatDemoIds.artifactLinks,
        request: 'Show me the inspectable outputs you created.',
        reply: [
            'Created two inspectable Memory notes:',
            '',
            '- [Artifact Panel brief](tavern://wiki/Demos/Panel%20Brief.md)',
            '- [Inspectable output rules](tavern://wiki/Demos/Output%20Rules.md)',
            '',
            'Workspace links use the same shape. This one opens the panel with the current unsupported state: [preview.html](tavern://workspace/out/preview.html).',
        ].join('\n'),
        slug: 'artifact_links',
        summary: 'Linked inspectable outputs for the Artifact Panel demo.',
        title: 'Demo: Artifact Links',
    });
}

export function longContentDemo(): DevelopmentChatDemo {
    return completedTextDemo({
        chatId: developmentChatDemoIds.longContent,
        title: 'Demo: Long Content',
        request: longPastedOAuthJson,
        reply: `Auth URL created. Open this URL:\n\n${longOAuthConsentUrl}\n\nAfter authorizing, copy the localhost callback URL and paste it here.`,
        slug: 'long_content',
        summary: 'Shows long pasted JSON and a long URL in chat.',
    });
}

export function attachmentDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.attachment;
    const runId = 'run_demo_attachment';
    const requestMessageId = 'msg_demo_attachment_request';
    const responseMessageId = 'msg_demo_attachment_response';

    return {
        chatId,
        title: 'Demo: Attachment',
        messages: [
            userMessage({
                attachments: [
                    {
                        filename: 'weather-request.txt',
                        mediaType: 'text/plain',
                        path: '/attachments/weather-request.txt',
                        sizeBytes: 184,
                        type: 'file',
                    },
                ],
                chatId,
                content: 'hi dude, can you please fetch the weather in the 5 biggest us cities',
                id: requestMessageId,
                nonce: 'demo-attachment-request',
            }),
            assistantMessage({
                chatId,
                content: 'Yep. I can use the attached brief and keep the response compact.',
                id: responseMessageId,
                nonce: 'demo-attachment-response',
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            completedResponse({
                chatId,
                id: 'rsp_demo_attachment',
                requestMessageId,
                responseMessageId,
                runId,
                summary: 'Answered a message with a file attachment.',
            }),
        ],
    };
}

function completedTextDemo(input: {
    chatId: string;
    request: string;
    reply: string;
    slug: string;
    summary: string;
    title: string;
}): DevelopmentChatDemo {
    const runId = `run_demo_${input.slug}`;
    const requestMessageId = `msg_demo_${input.slug}_request`;
    const responseMessageId = `msg_demo_${input.slug}_response`;

    return {
        chatId: input.chatId,
        title: input.title,
        messages: [
            userMessage({
                chatId: input.chatId,
                content: input.request,
                id: requestMessageId,
                nonce: `demo-${input.slug}-request`,
            }),
            assistantMessage({
                chatId: input.chatId,
                content: input.reply,
                id: responseMessageId,
                nonce: `demo-${input.slug}-response`,
                requestMessageId,
                runId,
            }),
        ],
        responses: [
            completedResponse({
                chatId: input.chatId,
                id: `rsp_demo_${input.slug}`,
                requestMessageId,
                responseMessageId,
                runId,
                summary: input.summary,
            }),
        ],
    };
}

export function widgetDemoRenderInput(
    name: WidgetName,
    fallbackText: string,
    props: Record<string, unknown>
): WidgetRenderInput {
    return widgetRenderInputSchema.parse({
        component: widgetComponentId(name),
        fallback: { text: fallbackText },
        props,
        target: 'chat.inline',
    });
}

// A short exchange authored by the app owner (`usr_tavern`) rather than the
// other demo participant, so the consolidated demo shows the viewer's own
// right-anchored, avatar-less bubbles alongside the left roster.
const selfDemoTurns = [
    {
        ask: 'Can you give me a quick status on the launch?',
        reply: 'All green — the last deploy passed and there are no open incidents.',
    },
    {
        ask: 'Nice. Anything I should double-check before I sign off?',
        reply: 'Just confirm the release note reads cleanly; everything else is verified.',
    },
] as const;

export function selfMessagesDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.demo;

    return {
        chatId,
        title: 'Demo: Your Messages',
        messages: selfDemoTurns.flatMap((turn, index) => {
            const ids = selfDemoTurnIds(index);

            return [
                ownerMessage({
                    chatId,
                    content: turn.ask,
                    id: ids.requestMessageId,
                    nonce: `${ids.slug}-request`,
                }),
                assistantMessage({
                    chatId,
                    content: turn.reply,
                    id: ids.responseMessageId,
                    nonce: `${ids.slug}-response`,
                    requestMessageId: ids.requestMessageId,
                    runId: ids.runId,
                }),
            ];
        }),
        responses: selfDemoTurns.map((turn, index) => {
            const ids = selfDemoTurnIds(index);

            return completedResponse({
                chatId,
                id: ids.responseId,
                requestMessageId: ids.requestMessageId,
                responseMessageId: ids.responseMessageId,
                runId: ids.runId,
                summary: turn.reply,
            });
        }),
    };
}

function selfDemoTurnIds(index: number) {
    const number = String(index + 1).padStart(2, '0');
    const slug = `demo-self-${number}`;

    return {
        requestMessageId: `msg_demo_self_${number}_request`,
        responseId: `rsp_demo_self_${number}`,
        responseMessageId: `msg_demo_self_${number}_response`,
        runId: `run_demo_self_${number}`,
        slug,
    };
}
