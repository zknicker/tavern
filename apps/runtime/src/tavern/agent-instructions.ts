import { prepareAgentEngineInstructions } from '../agent-engine/instructions.ts';
import { isRuntimeCronReady } from '../cron/manager-state.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { isMemoryEnabled } from '../memory/settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';

export interface BuildAgentInstructionOptions {
    db?: Database;
    seedSkills?: boolean;
    skillsDir?: string;
}

export async function buildAgentInstructions(
    input: AgentExecutorInput,
    options: BuildAgentInstructionOptions = {}
) {
    const prepared = await prepareAgentEngineInstructions(options.db ?? getDb(), input.agent, {
        seedSkills: options.seedSkills,
        skillsDir: options.skillsDir,
    });
    return [prepared.content, tavernChatInstructions(input)].join('\n\n');
}

// Static per-session guidance lives here instead of the per-turn prompt so a
// long session carries one copy in its system prompt rather than one per turn.
function tavernChatInstructions(input: AgentExecutorInput) {
    return [
        'Current Tavern chat:',
        `- chatId: ${input.chatId}`,
        '- Each turn prompt states the current time and every chat message carries its created-at timestamp. Weigh message timestamps against the current time; treat older context and prior data reads as stale until re-checked.',
        '',
        'Available Tavern chat tools:',
        '- chat_messages_list: list current-chat messages by sequence cursor',
        '- chat_messages_search: search current-chat messages',
        '- chat_message_get: read one current-chat message by id',
        ...(isMemoryEnabled()
            ? [
                  '',
                  'Available Tavern Memory tools (shared durable knowledge):',
                  '- memory_search: search shared Memory pages — check before assuming you lack context on something the user references',
                  '- memory_list_pages: list shared Memory pages and folders',
                  '- memory_read_page: read one shared Memory page with its hash',
                  '- memory_write_page: write one shared Memory page (explicit user-requested Memory work only)',
              ]
            : []),
        ...(isRuntimeCronReady()
            ? [
                  '',
                  'Available Tavern automation tools:',
                  '- cron_list: list your scheduled automations',
                  '- cron_create: schedule your message into a chat after confirming schedule and chat with the user',
                  '- cron_update: update one of your scheduled automations',
                  '- cron_delete: delete one of your scheduled automations',
              ]
            : []),
    ].join('\n');
}
