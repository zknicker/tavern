import { darkTheme } from '@uiw/react-json-view/dark';
import type React from 'react';

export const toolJsonViewStyle: React.CSSProperties = {
    ...darkTheme,
    '--w-rjv-font-family': 'var(--font-mono)',
    '--w-rjv-background-color': 'transparent',
    '--w-rjv-border-left': '1px solid oklch(from #eeeef4 l c h / 0.08)',
    '--w-rjv-color': '#f5f5f5',
    '--w-rjv-key-string': '#acacb2',
    '--w-rjv-info-color': 'oklch(from #eeeef4 l c h / 0.3)',
    '--w-rjv-type-string-color': '#4ec38a',
    '--w-rjv-type-int-color': '#5ca2ff',
    '--w-rjv-type-float-color': '#5ca2ff',
    '--w-rjv-type-boolean-color': '#d4a24c',
    '--w-rjv-type-null-color': '#ef6b6b',
    '--w-rjv-type-undefined-color': '#ef6b6b',
    '--w-rjv-curlybraces-color': '#acacb2',
    '--w-rjv-brackets-color': '#acacb2',
    '--w-rjv-colon-color': '#acacb2',
    '--w-rjv-ellipsis-color': '#acacb2',
    '--w-rjv-arrow-color': 'oklch(from #eeeef4 l c h / 0.4)',
    fontSize: 'var(--text-code)',
    lineHeight: '1.6',
} as React.CSSProperties;
