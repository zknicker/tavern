import type {
    TavernApiSchema,
    TavernChatMessage,
    TavernChatResponse,
    TavernResponseActivity,
} from '@tavern/api';

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
    active_turn_participant_ids: string | null;
    created_at: string;
    id: string;
    kind: 'channel' | 'dm' | 'task';
    last_activity_at: string | null;
    last_message_sequence: number;
    metadata_json: string;
    pinned: number;
    title: string | null;
    updated_at: string;
}

export interface ParticipantRow {
    chat_id: string;
    current_agent_session_id: string | null;
    id: string;
    kind: TavernApiSchema<'Participant'>['kind'];
    label: string | null;
    metadata_json: string;
}

export interface MessageRow {
    attachment_json: string | null;
    author_id: string;
    chat_id: string;
    content: string;
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

export interface EventRow {
    event_json: string;
}

export interface DeliveryRow {
    cursor: number;
    id: string;
    message_id: string;
}

export interface ResponseRow {
    chat_id: string;
    completed_at: string | null;
    created_at: string;
    deleted_at: string | null;
    id: string;
    metadata_json: string;
    participant_id: string;
    request_message_id: string | null;
    response_message_id: string | null;
    status: TavernChatResponse['status'];
    summary: string | null;
    updated_at: string;
}

export interface ActivityRow {
    artifact_ids_json: string;
    chat_id: string;
    completed_at: string | null;
    detail: string | null;
    id: string;
    kind: TavernResponseActivity['kind'];
    metadata_json: string;
    response_id: string;
    sequence: number;
    started_at: string;
    status: TavernResponseActivity['status'];
    summary: string | null;
    title: string;
    updated_at: string;
}

export interface ArtifactRow {
    activity_id: string | null;
    chat_id: string;
    content_ref: string | null;
    content_text: string | null;
    created_at: string;
    id: string;
    kind: string;
    message_id: string | null;
    metadata_json: string;
    mime_type: string | null;
    response_id: string | null;
    title: string | null;
    updated_at: string;
}

export interface ReadRow {
    chat_id: string;
    cursor: number;
    last_read_sequence: number;
    read_at: string;
    reader_id: string;
}
