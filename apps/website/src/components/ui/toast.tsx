'use client';

import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Spinner } from './spinner.tsx';

type ToastType = 'default' | 'error' | 'info' | 'loading' | 'success' | 'warning';
interface ToastData {
    type?: ToastType;
}

export const toastManager = ToastPrimitive.createToastManager<ToastData>();

export function ToastProvider({ children }: { children: React.ReactNode }) {
    return (
        <ToastPrimitive.Provider limit={3} timeout={4000} toastManager={toastManager}>
            {children}
            <ToastViewport />
        </ToastPrimitive.Provider>
    );
}

function ToastViewport() {
    const manager = ToastPrimitive.useToastManager<ToastData>();

    return (
        <ToastPrimitive.Portal>
            <ToastPrimitive.Viewport
                className="fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none"
                data-slot="toast-viewport"
            >
                {manager.toasts.map((toast) => (
                    <ToastPrimitive.Root
                        className={cn(
                            'rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-black/10 shadow-lg outline-none transition-[opacity,transform] duration-150 data-ending-style:translate-y-1 data-starting-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:opacity-0',
                            toast.type === 'error' &&
                                'border-error/35 bg-error-bg text-error-foreground',
                            toast.type === 'loading' && 'border-border bg-popover'
                        )}
                        key={toast.id}
                        toast={toast}
                    >
                        <ToastPrimitive.Content className="flex min-w-0 items-start gap-2">
                            {toast.type === 'loading' ? (
                                <Spinner className="mt-0.5 shrink-0" />
                            ) : null}
                            <div className="min-w-0">
                                {toast.title ? (
                                    <ToastPrimitive.Title className="font-medium text-sm leading-5">
                                        {toast.title}
                                    </ToastPrimitive.Title>
                                ) : null}
                                {toast.description ? (
                                    <ToastPrimitive.Description className="mt-0.5 text-muted-foreground text-xs leading-4">
                                        {toast.description}
                                    </ToastPrimitive.Description>
                                ) : null}
                            </div>
                        </ToastPrimitive.Content>
                    </ToastPrimitive.Root>
                ))}
            </ToastPrimitive.Viewport>
        </ToastPrimitive.Portal>
    );
}
