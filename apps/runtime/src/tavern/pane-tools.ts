import type { ToolSet } from '@ai-sdk/provider-utils';
import { parseChatPaneTargetLink } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { openPaneTargetForAgent } from '../pane/open-target.ts';

// Agent-driven artifact presentation: pane_open raises the open-pane-target
// UI intent for the current chat (specs/agent-app-control.md). Seat gating and
// target validation live in openPaneTargetForAgent; the tool call itself is
// the transcript evidence for what the agent opened.
export function createTavernPaneTools(input: { agentId: string; chatId: string }): ToolSet {
    return {
        pane_open: tool({
            description:
                "Open or focus a workspace file or Wiki page as a tab in the current chat's artifact pane, so the user sees it beside the chat. Use it when you produce or update a reviewable artifact. Repeating a target focuses its existing tab. A success means the tab is recorded; the user controls pane visibility.",
            inputSchema: z.object({
                target: z
                    .string()
                    .min(1)
                    .describe(
                        'tavern://workspace/<path> link to one of your workspace files, or tavern://wiki/<path> link to an existing Wiki page.'
                    ),
            }),
            execute: async ({ target }) => {
                const parsed = parseChatPaneTargetLink(target);
                if (!parsed) {
                    return {
                        error: 'Target must be a tavern://workspace/<path> or tavern://wiki/<path> link.',
                    };
                }
                const result = await openPaneTargetForAgent({
                    agentId: input.agentId,
                    chatId: input.chatId,
                    target: parsed,
                });
                if (!result.ok) {
                    return { error: result.error };
                }
                return { opened: true, tabCount: result.state.targets.length, target: parsed };
            },
        }),
    };
}
