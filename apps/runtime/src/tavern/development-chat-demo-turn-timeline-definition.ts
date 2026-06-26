import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import {
    assistantMessage,
    completedResponse,
    type DevelopmentChatDemo,
    demoTime,
    userMessage,
} from './development-chat-demo-types';

const timelineTurns = [
    ['Sketch a launch checklist.', 'Launch checklist: owner, smoke test, release note.'],
    ['Make it more operator-focused.', 'Operator version: verify state, capture evidence, ship.'],
    ['Add a risk pass.', 'Risks: stale data, missing rollback, unclear owner.'],
    ['Turn that into chat copy.', 'Copy: "I verified the path, ran checks, and captured the ids."'],
    [
        'What should the preview show?',
        'The preview should lead with the user ask and latest outcome.',
    ],
    [
        'Try a longer request label.',
        'Long labels truncate cleanly while the card keeps the full context.',
    ],
    [
        'Summarize the current state.',
        'State: centered rail, compact markers, selectable turn previews.',
    ],
    [
        'Add a follow-up about scrolling.',
        'Selecting a marker scrolls the transcript to that user turn.',
    ],
    ['What about failed turns?', 'Failed turns tint the dash and preview the error text.'],
    ['What about active turns?', 'Active turns use the stronger dash color and live status text.'],
    ['Keep this one short.', 'Short turn confirmed.'],
    [
        'Now add a medium answer.',
        'Medium answer: enough content to prove preview density without noise.',
    ],
    ['Mention tool work.', 'Tool work remains in drawers; the rail previews the surrounding turn.'],
    ['Mention rich responses.', 'Rich Responses stay inline; the rail still indexes the turn.'],
    ['Mention keyboard focus.', 'Keyboard focus expands the dash and opens the preview card.'],
    ['Mention hover motion.', 'Hover expands the focused dash and tapers nearby dashes.'],
    ['Mention dense history.', 'Dense history keeps all markers centered in the chat pane.'],
    [
        'Mention old turns.',
        'Older loaded turns are selectable as long as they are in the transcript.',
    ],
    [
        'Mention current limits.',
        'The rail represents loaded user-to-agent turns, not unloaded history.',
    ],
    ['Wrap it up.', 'Done: twenty back-and-forth turns for timeline testing.'],
] as const;

export function turnTimelineDemo(): DevelopmentChatDemo {
    const chatId = developmentChatDemoIds.turnTimeline;

    return {
        chatId,
        title: 'Demo: Turn Timeline',
        messages: timelineTurns.flatMap(([request, reply], index) => {
            const ids = timelineTurnIds(index);

            return [
                userMessage({
                    chatId,
                    content: request,
                    createdAt: timelineTurnTimestamp(index, 0),
                    id: ids.requestMessageId,
                    nonce: `${ids.slug}-request`,
                }),
                assistantMessage({
                    chatId,
                    content: reply,
                    createdAt: timelineTurnTimestamp(index, 30),
                    id: ids.responseMessageId,
                    nonce: `${ids.slug}-response`,
                    requestMessageId: ids.requestMessageId,
                    runId: ids.runId,
                }),
            ];
        }),
        responses: timelineTurns.map(([, reply], index) => {
            const ids = timelineTurnIds(index);

            return completedResponse({
                chatId,
                id: ids.responseId,
                requestMessageId: ids.requestMessageId,
                responseMessageId: ids.responseMessageId,
                runId: ids.runId,
                summary: reply,
            });
        }),
    };
}

function timelineTurnIds(index: number) {
    const number = String(index + 1).padStart(2, '0');
    const slug = `demo-turn-timeline-${number}`;

    return {
        requestMessageId: `msg_demo_turn_timeline_${number}_request`,
        responseId: `rsp_demo_turn_timeline_${number}`,
        responseMessageId: `msg_demo_turn_timeline_${number}_response`,
        runId: `run_demo_turn_timeline_${number}`,
        slug,
    };
}

function timelineTurnTimestamp(index: number, offsetSeconds: number) {
    const timestamp = Date.parse(demoTime) + index * 60_000 + offsetSeconds * 1000;

    return new Date(timestamp).toISOString();
}
