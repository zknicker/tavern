import type { TavernChatMessage, TavernMessageTask, TavernTaskLabel } from '@tavern/api';

export type TaskStatus = TavernMessageTask['status'];
export type TaskPriority = TavernMessageTask['priority'];

export interface TaskListItem {
    chat_id: string;
    chat_kind: 'channel' | 'dm';
    chat_title: string;
    message: TavernChatMessage;
    task: TavernMessageTask;
}

export interface ReminderRecord {
    anchor_chat_id: string | null;
    anchor_message_id: string | null;
    created_at: string;
    fire_at: string;
    id: string;
    owner_agent_id: string;
    owner_handle: string | null;
    repeat: string | null;
    script: string | null;
    status: 'scheduled' | 'fired' | 'canceled';
    title: string;
    updated_at: string;
}

export interface ReminderRun {
    errorMessage: string | null;
    firedAt: string;
    id: string;
    messageId: string | null;
    outcome: 'fired' | 'quiet' | 'error';
    output: string | null;
    reminderId: string;
    scriptExitCode: number | null;
    scriptStderr: string | null;
}

export type LabelRecord = TavernTaskLabel;
