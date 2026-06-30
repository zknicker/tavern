import type { ComponentType } from 'react';
import { createBrowserRouter, createHashRouter, Navigate, useLocation } from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
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
                                    element: <Navigate replace to={appRoutes.memory} />,
                                },
                                {
                                    path: 'tasks',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/cron-page.tsx'),
                                        'CronPage'
                                    ),
                                },
                                {
                                    path: 'tasks/new',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/cron-editor-page.tsx'),
                                        'CronEditorPage'
                                    ),
                                },
                                {
                                    path: 'tasks/edit/:jobId',
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
                                    element: <Navigate replace to={appRoutes.memory} />,
                                },
                                {
                                    path: 'logs',
                                    element: <Navigate replace to={appRoutes.memory} />,
                                },
                                {
                                    path: 'workspace',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/workspace-page.tsx'),
                                        'WorkspacePage'
                                    ),
                                },
                                {
                                    path: 'memory',
                                    lazy: lazyRoute(
                                        () => import('./routes/app/vault-page.tsx'),
                                        'VaultPage'
                                    ),
                                },
                                {
                                    path: 'pulse',
                                    element: <Navigate replace to={appRoutes.memory} />,
                                },
                                {
                                    path: 'memories',
                                    element: <Navigate replace to={appRoutes.memory} />,
                                },
                                {
                                    path: 'vault',
                                    element: <Navigate replace to={appRoutes.memory} />,
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
                                            lazy: lazyRoute(
                                                () => import('./routes/app/tools-page.tsx'),
                                                'ToolsPage'
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
                                            element: <Navigate replace to="agent-runtime" />,
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
            return resolveLegacyTaskPath(segments);
        case 'events':
        case 'logs':
        case 'memories':
        case 'pulse':
        case 'vault':
        case 'workers':
            return appRoutes.memory;
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
        case 'memory':
        case 'workspace':
            return `/${suffix}`;
        default:
            return appRoutes.overview;
    }
}

function resolveLegacyTaskPath(segments: string[]) {
    if (segments[0] === 'new') {
        return appRoutes.newTask;
    }

    if (segments[0] === 'edit' && segments[1]) {
        return `/tasks/edit/${segments.slice(1).join('/')}`;
    }

    return appRoutes.tasks;
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
