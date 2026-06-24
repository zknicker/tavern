import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toastManager } from '../../components/ui/toast.tsx';
import { type TavernUpdateStatus, useTavernUpdate } from './use-tavern-update.ts';

export function useTavernUpdateIndicator() {
    const { status, updateAndRestart } = useTavernUpdate();
    const navigate = useNavigate();
    const [shouldRender, setShouldRender] = useState(false);
    const isVisible = isVisibleTavernUpdateStatus(status);

    useEffect(() => {
        if (!isVisible) {
            setShouldRender(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShouldRender(true);
        }, 360);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isVisible]);

    const activate = useCallback(() => {
        if (status.phase === 'runtime-disconnected') {
            navigate('/dashboard/settings/agent-runtime');
            return;
        }

        toastManager.add({
            title: 'Update started',
            type: 'info',
        });
        updateAndRestart().catch(() => undefined);
    }, [navigate, status.phase, updateAndRestart]);

    if (!(isVisible && shouldRender)) {
        return null;
    }

    return {
        activate,
        canAct: canActOnTavernUpdate(status),
        label: getUpdateLabel(status),
        progress: status.phase === 'downloading-app' ? status.progress : undefined,
        sidebarLabel: getSidebarUpdateLabel(status),
        status,
    };
}

export function isVisibleTavernUpdateStatus(status: TavernUpdateStatus) {
    return (
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'staging-runtime' ||
        status.phase === 'downloading-app' ||
        status.phase === 'failed' ||
        status.phase === 'runtime-disconnected' ||
        status.phase === 'ready' ||
        status.phase === 'restarting-runtime' ||
        status.phase === 'restarting-app'
    );
}

export function canActOnTavernUpdate(status: TavernUpdateStatus) {
    return (
        status.phase === 'app-update-required' ||
        status.phase === 'available' ||
        status.phase === 'failed' ||
        status.phase === 'runtime-disconnected' ||
        status.phase === 'ready'
    );
}

export function getUpdateLabel(status: TavernUpdateStatus) {
    switch (status.phase) {
        case 'available':
            return 'Update';
        case 'app-update-required':
            return 'Tavern Update Required';
        case 'staging-runtime':
            return 'Staging Runtime';
        case 'downloading-app':
            return `Updating ${Math.round((status.progress ?? 0) * 100)}%`;
        case 'ready':
            return 'Ready to install';
        case 'failed':
            return 'Update Failed';
        case 'runtime-disconnected':
            return 'Runtime Disconnected';
        case 'restarting-runtime':
            return 'Restarting Runtime';
        case 'restarting-app':
            return 'Restarting';
        default:
            return 'Update';
    }
}

export function getSidebarUpdateLabel(status: TavernUpdateStatus) {
    switch (status.phase) {
        case 'available':
        case 'app-update-required':
            return 'Update Available';
        case 'staging-runtime':
        case 'downloading-app':
            return 'Update In Progress';
        case 'restarting-runtime':
        case 'restarting-app':
            return 'Restarting...';
        case 'ready':
            return 'Ready to Install';
        case 'failed':
            return 'Update Failed';
        case 'runtime-disconnected':
            return 'Runtime Disconnected';
        default:
            return 'Update';
    }
}
