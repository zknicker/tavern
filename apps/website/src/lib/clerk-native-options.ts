import type { ClerkProviderProps } from '@clerk/clerk-react';

export const clerkNativeOptions = {
    standardBrowser: false,
} satisfies Pick<ClerkProviderProps, 'standardBrowser'>;
