import type { components, operations, paths } from './generated/openapi.d.ts';

export type { components, operations, paths, webhooks } from './generated/openapi.d.ts';

export type TavernApiComponents = components;
export type TavernApiPaths = paths;
export type TavernApiOperations = operations;

export type TavernApiSchema<Name extends keyof components['schemas']> = components['schemas'][Name];

export type TavernArtifact = TavernApiSchema<'ChatArtifact'>;
export type TavernChat = TavernApiSchema<'Chat'>;
export type TavernChatEvent = TavernApiSchema<'ChatEvent'>;
export type TavernChatMessage = TavernApiSchema<'ChatMessage'>;
export type TavernChatMessageReceipt = TavernApiSchema<'ChatMessageReceipt'>;
export type TavernChatResponse = TavernApiSchema<'ChatResponse'>;
export type TavernCreateChatRequest = TavernApiSchema<'CreateChatRequest'>;
export type TavernCreateDeliveryRequest = TavernApiSchema<'CreateDeliveryRequest'>;
export type TavernCreateMessageRequest = TavernApiSchema<'CreateMessageRequest'>;
export type TavernEventList = TavernApiSchema<'EventList'>;
export type TavernListChatsResponse = TavernApiSchema<'ListChatsResponse'>;
export type TavernListMessagesResponse = TavernApiSchema<'ListMessagesResponse'>;
export type TavernListResponsesResponse = TavernApiSchema<'ListResponsesResponse'>;
export type TavernMarkReadRequest = TavernApiSchema<'MarkReadRequest'>;
export type TavernResponseActivity = TavernApiSchema<'ResponseActivity'>;
export type TavernUpsertArtifactRequest = TavernApiSchema<'UpsertArtifactRequest'>;
export type TavernUpsertResponseActivityRequest = TavernApiSchema<'UpsertResponseActivityRequest'>;
export type TavernUpsertResponseRequest = TavernApiSchema<'UpsertResponseRequest'>;

export * from './runtime/contracts.js';
export * from './runtime/cortex-defaults.js';
export * from './runtime/model-identity.js';
export * from './runtime/model-providers.js';
export * from './runtime/routes.js';
export * from './runtime/runtime-aliases.js';
export * from './runtime/skills.js';
