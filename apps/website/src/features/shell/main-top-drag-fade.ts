export function shouldShowMainTopDragFade(pathname: string) {
    return (
        pathname.startsWith('/dashboard/chats/') || pathname === '/dashboard/chat-layout-preview'
    );
}
