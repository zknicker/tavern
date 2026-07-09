import {
    agentRuntimeCreateTaskSchema,
    agentRuntimeDispatchTaskSchema,
    agentRuntimeRoutes,
    agentRuntimeSetTaskWorkChatSchema,
    agentRuntimeTaskListSchema,
    agentRuntimeTaskSchema,
    agentRuntimeUpdateTaskSchema,
} from '@tavern/api';
import { badRequest, json, notFound, readJson } from '../tavern/http.ts';
import { deleteTaskAttachment, readTaskAttachment } from './attachments.ts';
import { publishTaskDeleted, publishTaskUpdated } from './events.ts';
import {
    createTask,
    deleteTask,
    getTask,
    listTasks,
    setTaskWorkChat,
    updateTask,
} from './store.ts';
import { dispatchTaskWorkOrder } from './work-order.ts';

export function handleTasksRequest(request: Request): Promise<Response | null> | Response | null {
    const url = new URL(request.url);
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (segments[0] !== 'tasks') {
        return null;
    }

    return respondToTasksRequest({ method, request, segments, url });
}

async function respondToTasksRequest(input: {
    method: string;
    request: Request;
    segments: string[];
    url: URL;
}): Promise<Response | null> {
    const { method, request, segments, url } = input;

    try {
        if (method === 'GET' && url.pathname === agentRuntimeRoutes.tasks) {
            return json(agentRuntimeTaskListSchema.parse({ tasks: listTasks() }));
        }
        if (method === 'POST' && url.pathname === agentRuntimeRoutes.tasks) {
            const task = createTask(agentRuntimeCreateTaskSchema.parse(await readJson(request)));
            publishTaskUpdated(task.id);
            return json(agentRuntimeTaskSchema.parse(task), 201);
        }
        if (!segments[1]) {
            return null;
        }

        const taskId = segments[1];
        if (segments[2] === 'attachments' && segments[3] && !segments[4]) {
            const attachmentId = segments[3];
            if (method === 'GET') {
                const attachment = await readTaskAttachment(taskId, attachmentId);
                return attachment ? json(attachment) : notFound();
            }
            if (method === 'DELETE') {
                const deleted = await deleteTaskAttachment(taskId, attachmentId);
                return deleted ? json({ deleted: true, id: attachmentId }) : notFound();
            }
            return null;
        }
        if (segments[2] === 'dispatch' && !segments[3] && method === 'POST') {
            const input = agentRuntimeDispatchTaskSchema.parse(await readJson(request));
            return json(
                await dispatchTaskWorkOrder({
                    agentId: input.agentId,
                    taskId,
                    trigger: 'manual',
                })
            );
        }
        if (segments[2] === 'work-chat' && !segments[3] && method === 'POST') {
            const task = setTaskWorkChat(
                taskId,
                agentRuntimeSetTaskWorkChatSchema.parse(await readJson(request)).workChatId
            );
            if (!task) {
                return notFound();
            }
            publishTaskUpdated(task.id);
            return json(agentRuntimeTaskSchema.parse(task));
        }
        if (segments[2]) {
            return null;
        }
        if (method === 'GET') {
            const task = getTask(taskId);
            return task ? json(agentRuntimeTaskSchema.parse(task)) : notFound();
        }
        if (method === 'PATCH') {
            const task = updateTask(
                taskId,
                agentRuntimeUpdateTaskSchema.parse(await readJson(request))
            );
            if (!task) {
                return notFound();
            }
            publishTaskUpdated(task.id);
            return json(agentRuntimeTaskSchema.parse(task));
        }
        if (method === 'DELETE') {
            const deleted = deleteTask(taskId);
            if (!deleted) {
                return notFound();
            }
            publishTaskDeleted(taskId);
            return json({ deleted: true, id: taskId });
        }
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }

    return null;
}
