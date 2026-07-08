import type { ComponentType } from 'react';
import {
    createBrowserRouter,
    createHashRouter,
    Navigate,
    useLocation,
    useParams,
} from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { buildAgentSettingsPath } from './features/agents/agent-path.ts';
import { buildDefaultWorkspaceChatPath } from './features/chats/chat-path.ts';
import { RuntimeSetupGate } from './features/onboarding/runtime-setup-gate.tsx';
import { Layout } from './layout.tsx';
import { isPackagedDesktopApp } from './lib/agent-runtime.ts';
import { appRoutes } from './lib/app-routes.ts';

function lazyRoute<TModule extends Record<string, unknown>>(
    load: () => Promise<TModule>,
    exportName: keyof TModule
) {
    return async () => {
        const module = await load();
        const Component = module[exportName];

        if (typeof Component !== 'function') {
            throw new Error(`Route export "${String(exportName)}" is not a component.`);
        }

        return {
            Component: Component as ComponentType,
        };
    };
}

export function createAppRouter() {
    const createRouter = isPackagedDesktopApp() ? createHashRouter : createBrowserRouter;

    return createRouter([
        {
            element: <AppFrame />,
            children: [
                {
                    path: '/onboarding',
                    lazy: lazyRoute(() => import('./routes/onboarding-page.tsx'), 'OnboardingPage'),
                },
                {
                    path: 'dashboard',
                    element: <LegacyDashboardRedirect />,
                },
                {
                    path: 'dashboard/*',
                    element: <LegacyDashboardRedirect />,
                },
                {
                    index: true,
                    element: <Navigate replace to={buildDefaultWorkspaceChatPath()} />,
                },
                {
                    element: <RuntimeSetupGate />,
                    children: [
                        {
                            element: <Layout />,
                            children: [
                                {
                                    index: true,
                                    element: (
                                        <Navigate replace to={buildDefaultWorkspaceChatPath()} />
                                    ),
                                },
                                {
                                    path: 'overview',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/overview-page.tsx'),
                                        'OverviewPage'
                                    ),
                                },
                                {
                                    path: 'stats',
                                    element: <Navigate replace to={appRoutes.settingsStats} />,
                                },
                                {
                                    path: 'agent',
                                    element: <Navigate replace to={appRoutes.settingsSessions} />,
                                },
                                {
                                    path: 'new/:tabKey',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/overview-page.tsx'),
                                        'OverviewPage'
                                    ),
                                },
                                {
                                    path: 'chats/:chatId',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/agent-chat-page.tsx'),
                                        'ChatPage'
                                    ),
                                },
                                {
                                    path: 'chats',
                                    element: (
                                        <Navigate replace to={buildDefaultWorkspaceChatPath()} />
                                    ),
                                },
                                {
                                    path: 'workers',
                                    element: <Navigate replace to={appRoutes.wiki} />,
                                },
                                {
                                    path: 'tasks',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/tasks-page.tsx'),
                                        'TasksPage'
                                    ),
                                },
                                {
                                    path: 'tasks/new',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/task-new-page.tsx'),
                                        'TaskNewPage'
                                    ),
                                },
                                {
                                    path: 'tasks/:taskId',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/task-detail-page.tsx'),
                                        'TaskDetailPage'
                                    ),
                                },
                                {
                                    path: 'automations',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/cron-page.tsx'),
                                        'CronPage'
                                    ),
                                },
                                {
                                    path: 'automations/new',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/cron-editor-page.tsx'),
                                        'CronEditorPage'
                                    ),
                                },
                                {
                                    path: 'automations/edit/:jobId',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/cron-editor-page.tsx'),
                                        'CronEditorPage'
                                    ),
                                },
                                {
                                    path: 'models',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/models-page.tsx'),
                                        'ModelsPage'
                                    ),
                                },
                                {
                                    path: 'skills',
                                    element: <Navigate replace to={appRoutes.settingsSkills} />,
                                },
                                {
                                    path: 'events',
                                    element: <Navigate replace to={appRoutes.wiki} />,
                                },
                                {
                                    path: 'logs',
                                    element: <Navigate replace to={appRoutes.wiki} />,
                                },
                                {
                                    path: 'workspace',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/workspace-page.tsx'),
                                        'WorkspacePage'
                                    ),
                                },
                                {
                                    path: 'wiki',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/wiki-page.tsx'),
                                        'WikiPage'
                                    ),
                                },
                                {
                                    path: 'pulse',
                                    element: <Navigate replace to={appRoutes.wiki} />,
                                },
                                {
                                    path: 'memories',
                                    element: <Navigate replace to={appRoutes.wiki} />,
                                },
                                {
                                    path: 'jobs',
                                    element: <Navigate replace to={appRoutes.overview} />,
                                },
                                {
                                    path: 'settings',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/settings-page.tsx'),
                                        'SettingsPage'
                                    ),
                                    children: [
                                        {
                                            index: true,
                                            element: <Navigate replace to="agent-runtime" />,
                                        },
                                        {
                                            path: 'agent-runtime',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-agent-runtime-page.tsx'
                                                    ),
                                                'SettingsAgentRuntimePage'
                                            ),
                                        },
                                        {
                                            path: 'appearance',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-appearance-page.tsx'
                                                    ),
                                                'SettingsAppearancePage'
                                            ),
                                        },
                                        {
                                            path: 'profile',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-profile-page.tsx'
                                                    ),
                                                'SettingsProfilePage'
                                            ),
                                        },
                                        {
                                            path: 'updates',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-updates-page.tsx'
                                                    ),
                                                'SettingsUpdatesPage'
                                            ),
                                        },
                                        {
                                            path: 'stats',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/stats-page.tsx'),
                                                'StatsPage'
                                            ),
                                        },
                                        {
                                            path: 'connections',
                                            element: (
                                                <Navigate
                                                    replace
                                                    to={appRoutes.settingsAgentRuntime}
                                                />
                                            ),
                                        },
                                        {
                                            path: 'models',
                                            lazy: lazyRoute(
                                                () =>
                                                    import('./routes/app/settings-models-page.tsx'),
                                                'SettingsModelsPage'
                                            ),
                                        },
                                        {
                                            path: 'sessions',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-sessions-page.tsx'
                                                    ),
                                                'SettingsSessionsPage'
                                            ),
                                        },
                                        {
                                            path: 'skills',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/skills-page.tsx'),
                                                'SkillsPage'
                                            ),
                                        },
                                        {
                                            path: 'tools',
                                            element: (
                                                <Navigate replace to={appRoutes.settingsPlugins} />
                                            ),
                                        },
                                        {
                                            path: 'plugins',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-plugins-page.tsx'
                                                    ),
                                                'SettingsPluginsPage'
                                            ),
                                        },
                                        {
                                            path: 'channels',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/channels-page.tsx'),
                                                'ChannelsPage'
                                            ),
                                        },
                                        {
                                            path: 'mcp',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/mcp-page.tsx'),
                                                'McpPage'
                                            ),
                                        },
                                        {
                                            path: 'jobs',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/settings-jobs-page.tsx'),
                                                'SettingsJobsPage'
                                            ),
                                        },
                                        {
                                            path: 'agents/:agentId/general',
                                            lazy: lazyRoute(
                                                () =>
                                                    import('./routes/app/settings-agent-page.tsx'),
                                                'SettingsAgentPage'
                                            ),
                                        },
                                        {
                                            path: 'agents/:agentId/skills',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-agent-skills-page.tsx'
                                                    ),
                                                'SettingsAgentSkillsPage'
                                            ),
                                        },
                                        {
                                            path: 'agents/:agentId/tools',
                                            element: <AgentSkillsRedirect />,
                                        },
                                        {
                                            path: 'agents/:agentId/plugins',
                                            element: <AgentSkillsRedirect />,
                                        },
                                        {
                                            path: 'agents/:agentId/channels',
                                            lazy: lazyRoute(
                                                () => import('./routes/app/channels-page.tsx'),
                                                'ChannelsPage'
                                            ),
                                        },
                                        {
                                            path: 'agents/:agentId/mcp',
                                            element: <AgentSkillsRedirect />,
                                        },
                                        {
                                            path: 'agents/:agentId/memory',
                                            element: (
                                                <Navigate replace to={appRoutes.settingsMemories} />
                                            ),
                                        },
                                        {
                                            path: 'agent',
                                            lazy: lazyRoute(
                                                () =>
                                                    import('./routes/app/settings-agent-page.tsx'),
                                                'SettingsAgentPage'
                                            ),
                                        },
                                        {
                                            path: 'notes-md',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-notes-md-page.tsx'
                                                    ),
                                                'SettingsNotesMdPage'
                                            ),
                                        },
                                        {
                                            path: 'soul-md',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-soul-md-page.tsx'
                                                    ),
                                                'SettingsSoulMdPage'
                                            ),
                                        },
                                        {
                                            path: 'memories',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-memories-page.tsx'
                                                    ),
                                                'SettingsMemoriesPage'
                                            ),
                                        },
                                        {
                                            path: 'tracking',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/app/settings-tracking-page.tsx'
                                                    ),
                                                'SettingsTrackingPage'
                                            ),
                                        },
                                        {
                                            path: '*',
                                            element: (
                                                <Navigate
                                                    replace
                                                    to={appRoutes.settingsAgentRuntime}
                                                />
                                            ),
                                        },
                                    ],
                                },
                                {
                                    path: '*',
                                    element: <Navigate replace to={appRoutes.overview} />,
                                },
                            ],
                        },
                    ],
                },
                {
                    path: '*',
                    element: <Navigate replace to={appRoutes.overview} />,
                },
            ],
        },
    ]);
}

function AgentSkillsRedirect() {
    const { agentId } = useParams();
    return <Navigate replace to={buildAgentSettingsPath(agentId, 'skills')} />;
}

function LegacyDashboardRedirect() {
    const location = useLocation();
    const targetPath = resolveLegacyDashboardPath(location.pathname);

    return <Navigate replace to={`${targetPath}${location.search}${location.hash}`} />;
}

function resolveLegacyDashboardPath(pathname: string) {
    const suffix = pathname.replace(/^\/dashboard\/?/u, '');

    if (suffix.length === 0) {
        return buildDefaultWorkspaceChatPath();
    }

    const [section, ...segments] = suffix.split('/');

    switch (section) {
        case 'agent':
            return appRoutes.settingsSessions;
        case 'chats':
            return segments.length === 0 ? buildDefaultWorkspaceChatPath() : `/${suffix}`;
        case 'cron':
            return resolveLegacyAutomationPath(segments);
        case 'events':
        case 'logs':
        case 'memories':
        case 'pulse':
        case 'workers':
            return appRoutes.wiki;
        case 'jobs':
        case 'models':
            return appRoutes.overview;
        case 'overview':
            return appRoutes.overview;
        case 'settings':
            return resolveLegacySettingsPath(segments);
        case 'skills':
            return appRoutes.settingsSkills;
        case 'stats':
            return appRoutes.settingsStats;
        case 'wiki':
        case 'workspace':
            return `/${suffix}`;
        default:
            return appRoutes.overview;
    }
}

function resolveLegacyAutomationPath(segments: string[]) {
    if (segments[0] === 'new') {
        return appRoutes.newAutomation;
    }

    if (segments[0] === 'edit' && segments[1]) {
        return `/automations/edit/${segments.slice(1).join('/')}`;
    }

    return appRoutes.automations;
}

function resolveLegacySettingsPath(segments: string[]) {
    const [section] = segments;

    if (!section) {
        return appRoutes.settings;
    }

    if (section === 'connections' || section === 'tracking') {
        return appRoutes.settingsAgentRuntime;
    }

    return `/settings/${segments.join('/')}`;
}
