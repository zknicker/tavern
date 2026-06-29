import type { ComponentType } from 'react';
import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { buildDefaultWorkspaceChatPath } from './features/chats/chat-path.ts';
import { DashboardSetupGate } from './features/onboarding/dashboard-setup-gate.tsx';
import { Layout } from './layout.tsx';
import { isPackagedDesktopApp } from './lib/agent-runtime.ts';

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
                    index: true,
                    element: <Navigate replace to={buildDefaultWorkspaceChatPath()} />,
                },
                {
                    path: 'dashboard',
                    element: <DashboardSetupGate />,
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
                                        () => import('./routes/dashboard/overview-page.tsx'),
                                        'OverviewPage'
                                    ),
                                },
                                {
                                    path: 'stats',
                                    element: <Navigate replace to="/dashboard/settings/stats" />,
                                },
                                {
                                    path: 'agent',
                                    element: <Navigate replace to="/dashboard/settings/sessions" />,
                                },
                                {
                                    path: 'new/:tabKey',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/overview-page.tsx'),
                                        'OverviewPage'
                                    ),
                                },
                                {
                                    path: 'chats/:chatId',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/agent-chat-page.tsx'),
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
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'cron',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/cron-page.tsx'),
                                        'CronPage'
                                    ),
                                },
                                {
                                    path: 'cron/new',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/cron-editor-page.tsx'),
                                        'CronEditorPage'
                                    ),
                                },
                                {
                                    path: 'cron/edit/:jobId',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/cron-editor-page.tsx'),
                                        'CronEditorPage'
                                    ),
                                },
                                {
                                    path: 'models',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/models-page.tsx'),
                                        'ModelsPage'
                                    ),
                                },
                                {
                                    path: 'skills',
                                    element: <Navigate replace to="/dashboard/settings/skills" />,
                                },
                                {
                                    path: 'events',
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'logs',
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'workspace',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/workspace-page.tsx'),
                                        'WorkspacePage'
                                    ),
                                },
                                {
                                    path: 'memory',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/vault-page.tsx'),
                                        'VaultPage'
                                    ),
                                },
                                {
                                    path: 'pulse',
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'memories',
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'vault',
                                    element: <Navigate replace to="/dashboard/memory" />,
                                },
                                {
                                    path: 'jobs',
                                    element: <Navigate replace to="/dashboard/overview" />,
                                },
                                {
                                    path: 'settings',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/settings-page.tsx'),
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
                                                        './routes/dashboard/settings-agent-runtime-page.tsx'
                                                    ),
                                                'SettingsAgentRuntimePage'
                                            ),
                                        },
                                        {
                                            path: 'appearance',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-appearance-page.tsx'
                                                    ),
                                                'SettingsAppearancePage'
                                            ),
                                        },
                                        {
                                            path: 'updates',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-updates-page.tsx'
                                                    ),
                                                'SettingsUpdatesPage'
                                            ),
                                        },
                                        {
                                            path: 'stats',
                                            lazy: lazyRoute(
                                                () => import('./routes/dashboard/stats-page.tsx'),
                                                'StatsPage'
                                            ),
                                        },
                                        {
                                            path: 'connections',
                                            element: (
                                                <Navigate
                                                    replace
                                                    to="/dashboard/settings/agent-runtime"
                                                />
                                            ),
                                        },
                                        {
                                            path: 'models',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-models-page.tsx'
                                                    ),
                                                'SettingsModelsPage'
                                            ),
                                        },
                                        {
                                            path: 'sessions',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-sessions-page.tsx'
                                                    ),
                                                'SettingsSessionsPage'
                                            ),
                                        },
                                        {
                                            path: 'skills',
                                            lazy: lazyRoute(
                                                () => import('./routes/dashboard/skills-page.tsx'),
                                                'SkillsPage'
                                            ),
                                        },
                                        {
                                            path: 'tools',
                                            lazy: lazyRoute(
                                                () => import('./routes/dashboard/tools-page.tsx'),
                                                'ToolsPage'
                                            ),
                                        },
                                        {
                                            path: 'plugins',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-plugins-page.tsx'
                                                    ),
                                                'SettingsPluginsPage'
                                            ),
                                        },
                                        {
                                            path: 'channels',
                                            lazy: lazyRoute(
                                                () =>
                                                    import('./routes/dashboard/channels-page.tsx'),
                                                'ChannelsPage'
                                            ),
                                        },
                                        {
                                            path: 'mcp',
                                            lazy: lazyRoute(
                                                () => import('./routes/dashboard/mcp-page.tsx'),
                                                'McpPage'
                                            ),
                                        },
                                        {
                                            path: 'jobs',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-jobs-page.tsx'
                                                    ),
                                                'SettingsJobsPage'
                                            ),
                                        },
                                        {
                                            path: 'agent',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-agent-page.tsx'
                                                    ),
                                                'SettingsAgentPage'
                                            ),
                                        },
                                        {
                                            path: 'notes-md',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-notes-md-page.tsx'
                                                    ),
                                                'SettingsNotesMdPage'
                                            ),
                                        },
                                        {
                                            path: 'soul-md',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-soul-md-page.tsx'
                                                    ),
                                                'SettingsSoulMdPage'
                                            ),
                                        },
                                        {
                                            path: 'memories',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-memories-page.tsx'
                                                    ),
                                                'SettingsMemoriesPage'
                                            ),
                                        },
                                        {
                                            path: 'tracking',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-tracking-page.tsx'
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
                                    element: <Navigate replace to="/dashboard/overview" />,
                                },
                            ],
                        },
                    ],
                },
                {
                    path: '*',
                    element: <Navigate replace to="/dashboard/overview" />,
                },
            ],
        },
    ]);
}
