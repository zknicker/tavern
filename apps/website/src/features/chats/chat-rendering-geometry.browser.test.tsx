import { afterAll, beforeAll, expect, test } from 'bun:test';
import { type Browser, chromium, type Page } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import {
    ChatTranscriptMessageContent,
    renderTranscriptMessageAttachments,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';

const appointmentText =
    'Your next dentist appointment is Dental Cleaning on Monday, September 28, 2026 at 10:00 AM EDT, at Meridian Dental, NYC. 🫡';

let browser: Browser;

beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
    await browser.close();
});

test('streaming word lift changes paint position without changing line layout', async () => {
    const page = await newGeometryPage(`
        <style>
            ${baseTextCss}

            @keyframes chat-streaming-text-unit-in {
                from {
                    opacity: 0;
                    transform: translateY(0.45em);
                    filter: blur(1px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                    filter: blur(0);
                }
            }

            .chat-streaming-text-unit {
                display: inline-block;
                line-height: inherit;
                vertical-align: baseline;
                animation: chat-streaming-text-unit-in 720ms cubic-bezier(0.16, 1, 0.3, 1) both paused;
            }
        </style>
        <div class="case" id="plain">
            <span class="target">Dental</span>
        </div>
        <div class="case" id="streaming">
            <span class="target chat-streaming-text-unit">Dental</span>
        </div>
    `);

    const metrics = await page.evaluate(() => {
        const readMetrics = (id: string) => {
            const root = document.getElementById(id);
            const target = root?.querySelector('.target');

            if (!(root instanceof HTMLElement && target instanceof HTMLElement)) {
                throw new Error(`Missing geometry target ${id}.`);
            }

            const rootRect = root.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            return {
                boxHeight: rootRect.height,
                offsetTop: targetRect.top - rootRect.top,
            };
        };

        return {
            plain: readMetrics('plain'),
            streaming: readMetrics('streaming'),
        };
    });

    expect(metrics.streaming.boxHeight).toBe(metrics.plain.boxHeight);
    expect(metrics.streaming.offsetTop - metrics.plain.offsetTop).toBeGreaterThan(3);

    await page.close();
});

test('active and durable assistant reply wrappers keep the same text geometry', async () => {
    const liveMarkup = renderToStaticMarkup(
        <ChatMessage
            actions={<button type="button">Copy</button>}
            animateEnter={false}
            from="assistant"
        >
            <ChatMarkdownText content={appointmentText} />
        </ChatMessage>
    );
    const durableMarkup = renderToStaticMarkup(
        <ChatMessage
            actions={<button type="button">Copy</button>}
            animateEnter={false}
            attachments={renderTranscriptMessageAttachments(
                assistantMessage(appointmentText).attachments
            )}
            from="assistant"
        >
            <ChatTranscriptMessageContent message={assistantMessage(appointmentText)} />
        </ChatMessage>
    );
    const page = await newGeometryPage(`
        <style>
            ${chatMessageCss}
        </style>
        <div class="reply-case" id="live">${liveMarkup}</div>
        <div class="reply-case" id="durable">${durableMarkup}</div>
    `);

    const metrics = await page.evaluate(() => {
        const readMetrics = (id: string) => {
            const root = document.getElementById(id);
            const body = root?.querySelector('.min-h-5');
            const textRoot = body?.querySelector('[data-selectable-text]') ?? body;

            if (
                !(
                    root instanceof HTMLElement &&
                    body instanceof HTMLElement &&
                    textRoot instanceof Node
                )
            ) {
                throw new Error(`Missing reply geometry target ${id}.`);
            }

            const rootRect = root.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(textRoot);

            const bodyRect = body.getBoundingClientRect();
            const textRect = Array.from(range.getClientRects()).find((rect) => rect.width > 0);

            if (!textRect) {
                throw new Error(`Missing text rect ${id}.`);
            }

            return {
                bodyTop: bodyRect.top - rootRect.top,
                bodyHeight: bodyRect.height,
                rootHeight: rootRect.height,
                textTop: textRect.top - bodyRect.top,
            };
        };

        return {
            durable: readMetrics('durable'),
            live: readMetrics('live'),
        };
    });

    expect(Math.abs(metrics.durable.bodyTop - metrics.live.bodyTop)).toBeLessThanOrEqual(0.5);
    expect(metrics.durable.bodyHeight).toBe(metrics.live.bodyHeight);
    expect(Math.abs(metrics.durable.rootHeight - metrics.live.rootHeight)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(metrics.durable.textTop - metrics.live.textTop)).toBeLessThanOrEqual(0.5);

    await page.close();
});

async function newGeometryPage(body: string): Promise<Page> {
    const page = await browser.newPage({
        deviceScaleFactor: 2,
        viewport: { height: 360, width: 1200 },
    });

    await page.setContent(`<!doctype html><html><body>${body}</body></html>`);

    return page;
}

const baseTextCss = `
    body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
    }

    .case {
        min-height: 20px;
        margin: 40px;
        color: #111;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
`;

const chatMessageCss = `
    ${baseTextCss}

    p {
        margin: 0;
    }

    .reply-case {
        margin: 40px;
    }

    .group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        max-width: 100%;
        gap: 6px;
        font-size: 14px;
        line-height: 1.5;
    }

    .min-h-5 {
        min-height: 20px;
    }

    .max-w-full {
        max-width: 100%;
    }

    .whitespace-pre-wrap {
        white-space: pre-wrap;
    }

    .break-words {
        word-break: normal;
        overflow-wrap: anywhere;
    }

    .text-sm {
        font-size: 14px;
        line-height: 1.5;
    }
`;

function assistantMessage(content: string): TranscriptMessage {
    return {
        attachments: [],
        content,
        id: 'msg_assistant_geometry',
        metadata: { runtime: { runId: 'run_geometry' } },
        sender: 'Agent',
        senderType: 'agent',
        sourceSessionId: null,
        sourceSessionKey: 'agent:main:tavern:channel:geometry',
        tavernAgentId: 'agt_main',
        timestamp: '2026-06-18T20:35:17.000Z',
    };
}
