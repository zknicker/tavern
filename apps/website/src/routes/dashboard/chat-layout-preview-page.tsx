import { getChatMessageLayout } from '../../features/chats/chat-message-layout.ts';
import { ChatTimeline } from '../../features/chats/chat-timeline.tsx';
import { chatLayoutPreviews } from './chat-layout-preview-data.ts';

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
            </div>
        </div>
    );
}
