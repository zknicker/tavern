import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useTaskList } from '../../hooks/tasks/use-task-list.ts';
import { useTaskCreate } from '../../hooks/tasks/use-task-mutations.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { useAgentSelectOptions } from '../agents/use-agent-select-options.ts';
import { TaskEditorPane } from './task-editor-pane.tsx';
import { TaskEditorSidebar } from './task-editor-sidebar.tsx';
import { TaskFields, type TaskFieldsValue } from './task-fields.tsx';
import { formatTaskNumber } from './task-presentation.ts';

const emptyDraftFields: TaskFieldsValue = {
    assignee: null,
    epicId: null,
    labels: [],
    priority: 'none',
    status: 'backlog',
};

export function TaskNew() {
    const navigate = useNavigate();
    const agentsQuery = useAgentList();
    const tasksQuery = useTaskList();
    const createMutation = useTaskCreate();
    const [kind, setKind] = React.useState<'epic' | 'task'>('task');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [fields, setFields] = React.useState<TaskFieldsValue>(emptyDraftFields);

    const agents = useAgentSelectOptions(agentsQuery.data?.agents);
    const epics = React.useMemo(
        () => (tasksQuery.data?.tasks ?? []).filter((candidate) => candidate.kind === 'epic'),
        [tasksQuery.data?.tasks]
    );

    const createTask = () => {
        const trimmedTitle = title.trim();

        if (!trimmedTitle) {
            return;
        }

        const trimmedDescription = description.trim();
        createMutation
            .mutateAsync({
                assignee: fields.assignee,
                description: trimmedDescription ? trimmedDescription : null,
                epicId: kind === 'task' ? fields.epicId : null,
                kind,
                labels: fields.labels,
                priority: fields.priority,
                status: fields.status,
                title: trimmedTitle,
            })
            .then((created) => {
                toastManager.add({
                    title: `${formatTaskNumber(created)} created`,
                    type: 'success',
                });
                navigate(appRoutes.task(created.id), { replace: true });
            })
            .catch((error: unknown) => {
                toastManager.add({
                    description: error instanceof Error ? error.message : 'Try again.',
                    title: kind === 'epic' ? 'Epic not created' : 'Task not created',
                    type: 'error',
                });
            });
    };

    const actions = (
        <div className="flex items-center justify-end gap-2">
            <Button
                onClick={() => navigate(appRoutes.tasks)}
                size="sm"
                type="button"
                variant="ghost"
            >
                Cancel
            </Button>
            <Button
                disabled={!title.trim()}
                loading={createMutation.isPending}
                onClick={createTask}
                size="sm"
                type="button"
            >
                {kind === 'epic' ? 'Create epic' : 'Create task'}
            </Button>
        </div>
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="px-4 pt-3 lg:hidden">{actions}</div>
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <TaskEditorPane
                    autoFocusTitle
                    description={description}
                    onDescriptionChange={setDescription}
                    onTitleChange={setTitle}
                    title={title}
                    titlePlaceholder={kind === 'epic' ? 'Untitled epic' : 'Untitled task'}
                />
                <TaskEditorSidebar>
                    <div className="max-lg:hidden">{actions}</div>
                    <TabsSubtle
                        onValueChange={(value) => setKind(value as 'epic' | 'task')}
                        value={kind}
                    >
                        <TabsSubtleList className="w-full">
                            <TabsSubtleItem className="flex-1" size="sm" value="task">
                                Task
                            </TabsSubtleItem>
                            <TabsSubtleItem className="flex-1" size="sm" value="epic">
                                Epic
                            </TabsSubtleItem>
                        </TabsSubtleList>
                    </TabsSubtle>
                    <Separator />
                    <TaskFields
                        agents={agents}
                        disabled={createMutation.isPending}
                        epics={epics}
                        onChange={(patch) => setFields((current) => ({ ...current, ...patch }))}
                        showEpic={kind === 'task'}
                        value={fields}
                    />
                </TaskEditorSidebar>
            </div>
        </div>
    );
}
