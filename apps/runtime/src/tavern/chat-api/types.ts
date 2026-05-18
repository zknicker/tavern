import type { TavernChatActivity, TavernChatMessage } from '@tavern/api';

export interface DeliveryReceipt {
    cursor: string;
    id: string;
    idempotent: boolean;
    message: TavernChatMessage;
}

export interface MessageReceipt {
    cursor: string;
    idempotent: boolean;
    message: TavernChatMessage;
}

export interface ReadReceipt {
    chat_id: string;
    cursor: string;
    last_read_sequence: number;
    read_at: string;
    reader_id: string;
}

export interface DeleteReceipt {
    cursor: string;
    deleted_at: string;
    message_id: string;
}

export interface ChatRow {
    created_at: string;
    id: string;
    last_message_sequence: number;
    metadata_json: string;
    title: string | null;
    updated_at: string;
}

export interface ParticipantRow {
    id: string;
    kind: TavernChatMessage['author']['kind'];
    label: string | null;
    metadata_json: string;
}

export interface MessageRow {
    author_id: string;
    chat_id: string;
    created_at: string;
    deleted_at: string | null;
    delivery_id: string | null;
    id: string;
    metadata_json: string;
    nonce: string | null;
    parent_message_id: string | null;
    role: TavernChatMessage['role'];
    sequence: number;
    thread_root_id: string | null;
}

export interface PartRow {
    content: string;
    id: string;
    kind: TavernChatMessage['parts'][number]['kind'];
    metadata_json: string;
}

export interface EventRow {
    event_json: string;
}

export interface DeliveryRow {
    cursor: number;
    id: string;
    message_id: string;
}

export interface ActivityRow {
    agent_id: string;
    chat_id: string;
    metadata_json: string;
    run_id: string;
    status: TavernChatActivity['status'];
    steps_json: string;
    summary: string | null;
    updated_at: string;
}

export interface ReadRow {
    chat_id: string;
    cursor: number;
    last_read_sequence: number;
    read_at: string;
    reader_id: string;
}
