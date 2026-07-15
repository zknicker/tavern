import { z } from 'zod';

export const connectionStateSchema = z.enum(['unconfigured', 'reachable', 'unreachable']);
export const agentKindSchema = z.enum(['human', 'agent']);
export const sessionStateSchema = z.enum(['running', 'idle', 'done', 'failed']);
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export const cronStateSchema = z.enum(['enabled', 'paused']);
export const agentPresenceStateSchema = z.enum(['busy', 'idle']);
export const dashboardSessionSenderTypeSchema = z.enum(['agent', 'system', 'user']);
