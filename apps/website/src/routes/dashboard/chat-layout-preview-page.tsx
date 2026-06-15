import * as React from 'react';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import {
    type ChatComposerQueuedMessage,
    moveQueuedMessage,
    promoteQueuedMessage,
} from '../../features/chats/chat-composer-queue.ts';
import { ChatComposerQueuePanel } from '../../features/chats/chat-composer-queue-panel.tsx';
import { getChatMessageLayout } from '../../features/chats/chat-message-layout.ts';
import { ChatTimeline } from '../../features/chats/chat-timeline.tsx';
import { chatComposerQueuePreviews, chatLayoutPreviews } from './chat-layout-preview-data.ts';

export function ChatLayoutPreviewPage() {
    return (
        <div className="h-full min-h-0 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex w-full max-w-[74rem] flex-col gap-5">
                <div className="px-1">
                    <h1 className="font-medium text-foreground text-lg">Chat Layout Preview</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Mocked conversations for participant mixes and rich message cases.
                    </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {chatLayoutPreviews.map((preview) => (
                        <section
                            className="min-h-[24rem] rounded-lg border border-border bg-background"
                            key={preview.title}
                        >
                            <div className="border-border border-b px-4 py-3">
                                <h2 className="font-medium text-foreground text-sm">
                                    {preview.title}
                                </h2>
                            </div>
                            <div className="px-2 py-3">
                                <ChatTimeline
                                    activeReply={null}
                                    conversationLayout={getChatMessageLayout(preview.chat)}
                                    rows={preview.rows}
                                    totalMessages={0}
                                />
                            </div>
                        </section>
                    ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {chatComposerQueuePreviews.map((preview) => (
                        <section
                            className="rounded-lg border border-border bg-background"
                            key={preview.title}
                        >
                            <div className="border-border border-b px-4 py-3">
                                <h2 className="font-medium text-foreground text-sm">
                                    {preview.title}
                                </h2>
                            </div>
                            <div className="flex min-h-[21rem] items-end px-6 pt-40 pb-6">
                                <ChatComposerQueuePreview
                                    initialQueue={preview.queue}
                                    isBlocked={preview.isBlocked}
                                />
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

function noop() {}

function ChatComposerQueuePreview({
    initialQueue,
    isBlocked,
}: {
    initialQueue: ChatComposerQueuedMessage[];
    isBlocked: boolean;
}) {
    const [queue, setQueue] = React.useState(() => [...initialQueue]);

    React.useEffect(() => {
        setQueue([...initialQueue]);
    }, [initialQueue]);

    return (
        <PromptInput className="w-full" onSubmit={(event) => event.preventDefault()}>
            <ChatComposerQueuePanel
                isBlocked={isBlocked}
                onEdit={noop}
                onMove={(id, direction) =>
                    setQueue((current) => moveQueuedMessage(current, id, direction))
                }
                onPromote={(id) => setQueue((current) => promoteQueuedMessage(current, id))}
                onRemove={(id) => setQueue((current) => current.filter((entry) => entry.id !== id))}
                onReorder={(nextQueue) => setQueue([...nextQueue])}
                queue={queue}
            />
            <PromptInputBody>
                <Textarea
                    aria-label="Static composer preview"
                    placeholder="Ask me anything..."
                    readOnly
                    textareaClassName="min-h-0 resize-none bg-transparent px-3 pt-1.5 pb-0 text-sm leading-6 placeholder:text-muted-foreground/60"
                    unstyled
                />
            </PromptInputBody>
            <PromptInputFooter>
                <PromptInputTools>
                    <span className="px-2 text-muted-foreground text-sm">+</span>
                </PromptInputTools>
                <PromptInputActions>
                    <span className="px-2 text-muted-foreground text-sm">Sonnet 5</span>
                    <PromptInputSubmit
                        canSubmit={isBlocked}
                        label={isBlocked ? 'Queue message' : 'Send message'}
                    />
                </PromptInputActions>
            </PromptInputFooter>
        </PromptInput>
    );
}
