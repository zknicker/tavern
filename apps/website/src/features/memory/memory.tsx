import * as React from 'react';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import { Card, CardContent } from '../../components/ui/card.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
import { memoryTabs } from './memory-tabs.ts';

function MemoryContent() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-4 pb-4">
            <div className="max-w-3xl">
                <h1 className="font-semibold text-2xl tracking-tight">Memory</h1>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                    Memory is the inspection surface for Tavern&apos;s generated continuity layers.
                    This page stays focused on activity, bulletin, and durable memory output rather
                    than configuration.
                </p>
            </div>

            <div>
                <BadgeDivider
                    className="pb-4"
                    subtext="Activity, bulletin, and durable memory stay separate so the generated memory output remains inspectable by layer."
                >
                    Memory Layers
                </BadgeDivider>
                <Card>
                    <CardContent className="p-4">
                        <Tabs defaultValue="activity">
                            <TabsList className="mb-4">
                                {memoryTabs.map((tab) => (
                                    <TabsTrigger key={tab.value} value={tab.value}>
                                        {tab.title}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {memoryTabs.map((tab) => (
                                <TabsContent
                                    className="outline-none"
                                    key={tab.value}
                                    value={tab.value}
                                >
                                    <div className="rounded-3xl border border-border/70 border-dashed bg-card/20 p-6">
                                        <p className="font-medium text-foreground text-sm">
                                            {tab.title}
                                        </p>
                                        <p className="mt-2 text-muted-foreground text-sm">
                                            {tab.description}
                                        </p>
                                        <p className="mt-4 text-muted-foreground text-sm leading-6">
                                            {tab.emptyState}
                                        </p>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export function Memory() {
    return (
        <React.Suspense fallback={<MemoryLoadingState />}>
            <MemoryContent />
        </React.Suspense>
    );
}

function MemoryLoadingState() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-4 pb-4">
            <div>
                <BadgeDivider className="pb-4" subtext="Loading memory inspection surfaces.">
                    Memory
                </BadgeDivider>
                <Card>
                    <CardContent className="p-4" />
                </Card>
            </div>
        </div>
    );
}
