import {
    agentRuntimeCreateTaskSchema,
    agentRuntimeTaskAssigneeSchema,
    agentRuntimeTaskKindSchema,
    agentRuntimeTaskPrioritySchema,
    agentRuntimeTaskSchema,
    agentRuntimeTaskStatusSchema,
    agentRuntimeUpdateTaskSchema,
} from '@tavern/api';
import * as z from 'zod';

export const taskSchema = agentRuntimeTaskSchema;
export const taskKindSchema = agentRuntimeTaskKindSchema;
export const taskPrioritySchema = agentRuntimeTaskPrioritySchema;
export const taskStatusSchema = agentRuntimeTaskStatusSchema;
export const taskAssigneeSchema = agentRuntimeTaskAssigneeSchema;

export const taskListSchema = z.object({
    tasks: z.array(taskSchema),
});

export const taskGetSchema = z.object({
    task: taskSchema.nullable(),
});

export const getTaskInputSchema = z.object({
    taskId: z.string().trim().min(1),
});

export const createTaskInputSchema = agentRuntimeCreateTaskSchema.omit({ id: true });

export const updateTaskInputSchema = z.object({
    patch: agentRuntimeUpdateTaskSchema,
    taskId: z.string().trim().min(1),
});

export const deleteTaskInputSchema = z.object({
    taskId: z.string().trim().min(1),
});

export const taskAttachmentInputSchema = z.object({
    attachmentId: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
});

export const dispatchTaskInputSchema = z.object({
    agentId: z.string().trim().min(1),
    taskId: z.string().trim().min(1),
});

export const dispatchTaskResultSchema = z.object({
    chatId: z.string().trim().min(1),
    task: taskSchema,
});

export type Task = z.infer<typeof taskSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type DispatchTaskInput = z.infer<typeof dispatchTaskInputSchema>;
export type DispatchTaskResult = z.infer<typeof dispatchTaskResultSchema>;
