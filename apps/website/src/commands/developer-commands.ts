import {
    CommandIcon,
    ComputerTerminal01Icon,
    RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { appRoutes } from '../lib/app-routes.ts';
import type { AppCommandBuildContext, AppCommandGroup } from './types.ts';

export function buildDeveloperCommandGroup(context: AppCommandBuildContext): AppCommandGroup {
    return {
        commands: [
            {
                icon: CommandIcon,
                id: 'developer.toggle-dev-mode',
                keywords: ['developer', 'debug', 'dev'],
                run: () => context.setDevMode(!context.devMode),
                title: context.devMode ? 'Turn Dev Mode Off' : 'Turn Dev Mode On',
            },
            {
                icon: ComputerTerminal01Icon,
                id: 'developer.runtime-settings',
                keywords: ['developer', 'runtime', 'health', 'capabilities'],
                run: () => context.navigate(appRoutes.settingsAgentRuntime),
                title: 'Runtime Settings',
            },
            {
                disabledReason: context.isCheckingRuntimeHealth
                    ? 'Runtime health check is already running.'
                    : null,
                icon: RefreshIcon,
                id: 'developer.check-runtime-health',
                keywords: ['developer', 'runtime', 'check', 'health', 'capabilities', 'refresh'],
                run: context.checkRuntimeHealth,
                title: context.isCheckingRuntimeHealth
                    ? 'Checking Runtime Health'
                    : 'Check Runtime Health',
            },
        ],
        id: 'developer',
        title: 'Developer',
    };
}
