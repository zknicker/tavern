'use client';

import type React from 'react';
import { cn } from '../../lib/utils.ts';

export interface ProgressProps {
    className?: string;
    /** CSS color for the filled portion */
    color?: string;
    /** 0–100 */
    value: number;
}

export function Progress({ className, value, color }: ProgressProps): React.ReactElement {
    return (
        <div className={cn('h-3 overflow-hidden rounded-full bg-muted', className)}>
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                    width: `${Math.min(100, Math.max(0, value))}%`,
                    backgroundColor: color,
                }}
            />
        </div>
    );
}
