'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { springs } from '../../lib/springs.ts';

export function ChatComposerMainDropOverlay({
    active,
    label = 'Drop to attach',
}: {
    active: boolean;
    label?: string;
}) {
    const shouldReduceMotion = useReducedMotion();
    const [container, setContainer] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
        setContainer(document.querySelector<HTMLElement>('[data-slot="app-shell-main"]'));
    }, []);

    if (!container) {
        return null;
    }

    return createPortal(
        <AnimatePresence initial={false}>
            {active ? (
                <motion.div
                    animate={{ opacity: 1, transform: 'scale(1)' }}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-sky-400/55 bg-sky-500/10 shadow-lg shadow-sky-500/15 backdrop-blur-[1px] md:rounded-[calc(var(--main-radius)-1px)]"
                    data-testid="chat-main-file-drop-overlay"
                    exit={
                        shouldReduceMotion
                            ? { opacity: 0, transition: springs.fast }
                            : {
                                  opacity: 0,
                                  transform: 'scale(0.99)',
                                  transition: springs.fast,
                              }
                    }
                    initial={
                        shouldReduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, transform: 'scale(0.99)' }
                    }
                    transition={springs.moderate}
                >
                    <div className="rounded-full bg-white px-5 py-2.5 font-medium text-foreground text-sm">
                        {label}
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>,
        container
    );
}
