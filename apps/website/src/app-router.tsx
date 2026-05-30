import type { ComponentType } from 'react';
import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom';
import { AppFrame } from './components/app-frame.tsx';
import { Layout } from './layout.tsx';
import { isPackagedTauriApp } from './lib/agent-runtime.ts';

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
    const createRouter = isPackagedTauriApp() ? createHashRouter : createBrowserRouter;

    return createRouter([
        {
            path: '/onboarding',
            lazy: lazyRoute(() => import('./routes/onboarding-page.tsx'), 'OnboardingPage'),
        },
        {
            path: '/',
            element: <AppFrame />,
            children: [
                {
                    index: true,
                    element: <Navigate replace to="/dashboard/overview" />,
                },
                {
                    path: 'dashboard',
                    lazy: lazyRoute(
                        () => import('./features/onboarding/tavern-runtime-gate.tsx'),
                        'TavernRuntimeGate'
                    ),
                    children: [
                        {
                            element: <Layout />,
                            children: [
                                {
                                    index: true,
                                    element: <Navigate replace to="overview" />,
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
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/stats-page.tsx'),
                                        'StatsPage'
                                    ),
                                },
                                {
                                    path: 'agent',
                                    element: <Navigate replace to="/dashboard/settings/sessions" />,
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
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/chats-page.tsx'),
                                        'ChatsPage'
                                    ),
                                },
                                {
                                    path: 'chat-layout-preview',
                                    lazy: lazyRoute(
                                        () =>
                                            import(
                                                './routes/dashboard/chat-layout-preview-page.tsx'
                                            ),
                                        'ChatLayoutPreviewPage'
                                    ),
                                },
                                {
                                    path: 'workers',
                                    element: <Navigate replace to="/dashboard/cortex" />,
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
                                    path: 'skills/:skillId',
                                    lazy: lazyRoute(
                                        () =>
                                            import(
                                                './routes/dashboard/legacy-skill-detail-redirect-page.tsx'
                                            ),
                                        'LegacySkillDetailRedirectPage'
                                    ),
                                },
                                {
                                    path: 'events',
                                    element: <Navigate replace to="/dashboard/cortex" />,
                                },
                                {
                                    path: 'logs',
                                    element: <Navigate replace to="/dashboard/cortex" />,
                                },
                                {
                                    path: 'avatar-test',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/avatar-test-page.tsx'),
                                        'AvatarTestPage'
                                    ),
                                },
                                {
                                    path: 'memory',
                                    element: <Navigate replace to="/dashboard/cortex" />,
                                },
                                {
                                    path: 'pulse',
                                    element: <Navigate replace to="/dashboard/cortex" />,
                                },
                                {
                                    path: 'memories',
                                    element: <Navigate replace to="/dashboard/cortex" />,
                                },
                                {
                                    path: 'cortex',
                                    lazy: lazyRoute(
                                        () => import('./routes/dashboard/cortex-page.tsx'),
                                        'CortexPage'
                                    ),
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
                                            path: 'skills/:skillId',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/skill-detail-page.tsx'
                                                    ),
                                                'SkillDetailPage'
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
                                            element: (
                                                <Navigate
                                                    replace
                                                    to="/dashboard/settings/sessions"
                                                />
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
                                            path: 'participants',
                                            lazy: lazyRoute(
                                                () =>
                                                    import(
                                                        './routes/dashboard/settings-participants-page.tsx'
                                                    ),
                                                'SettingsParticipantsPage'
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
