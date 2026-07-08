import '../../lib/prism-global.ts';
import {
    codeBlockPlugin,
    codeMirrorPlugin,
    headingsPlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    MDXEditor,
    type MDXEditorMethods,
    markdownShortcutPlugin,
    quotePlugin,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
} from '@mdxeditor/editor';
import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { getMarkdownStats } from './wiki-markdown-editor-utils.ts';
import { WikiEditorToolbar } from './wiki-mdx-toolbar.tsx';
import { fromMdxEditorMarkdown, toMdxEditorMarkdown } from './wiki-memory-link-markdown.ts';
import './wiki-markdown-editor.css';

interface WikiMarkdownEditorProps {
    className?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    saveDisabled: boolean;
    value: string;
}

export function WikiMarkdownEditor({
    className,
    disabled = false,
    onChange,
    onSave,
    saveDisabled,
    value,
}: WikiMarkdownEditorProps) {
    const editorRef = React.useRef<MDXEditorMethods>(null);
    const editorMarkdown = React.useMemo(() => toMdxEditorMarkdown(value), [value]);
    const lastAppliedValueRef = React.useRef(editorMarkdown);
    const [editorError, setEditorError] = React.useState<string | null>(null);
    const stats = React.useMemo(() => getMarkdownStats(value), [value]);
    const plugins = React.useMemo(
        () => [
            toolbarPlugin({
                toolbarContents: () => <WikiEditorToolbar />,
            }),
            headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
            codeMirrorPlugin({
                autoLoadLanguageSupport: false,
                codeBlockLanguages: {
                    css: 'CSS',
                    js: 'JavaScript',
                    json: 'JSON',
                    markdown: 'Markdown',
                    sh: 'Shell',
                    ts: 'TypeScript',
                    tsx: 'TSX',
                    txt: 'Plain text',
                },
            }),
            markdownShortcutPlugin(),
        ],
        []
    );

    React.useEffect(() => {
        if (lastAppliedValueRef.current === editorMarkdown) {
            return;
        }

        lastAppliedValueRef.current = editorMarkdown;
        editorRef.current?.setMarkdown(editorMarkdown);
        setEditorError(null);
    }, [editorMarkdown]);

    function handleChange(markdown: string, initialMarkdownNormalize: boolean) {
        if (initialMarkdownNormalize) {
            return;
        }

        lastAppliedValueRef.current = markdown;
        setEditorError(null);
        onChange(fromMdxEditorMarkdown(markdown));
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault();
            if (!saveDisabled) {
                onSave();
            }
        }
    }

    return (
        <div
            aria-disabled={disabled}
            className={cn('flex min-h-0 flex-col bg-background', className)}
            onKeyDownCapture={handleKeyDown}
        >
            <MDXEditor
                className="wiki-mdx-editor min-h-0 flex-1"
                contentEditableClassName="wiki-mdx-content"
                markdown={editorMarkdown}
                onChange={handleChange}
                onError={(payload) => setEditorError(payload.error)}
                placeholder="# Untitled"
                plugins={plugins}
                readOnly={disabled}
                ref={editorRef}
                spellCheck
                trim={false}
            />
            {editorError ? (
                <div className="border-border/70 border-t bg-destructive/5 px-4 py-2 text-destructive-foreground text-sm">
                    {editorError}
                </div>
            ) : null}
            <div className="flex min-h-8 shrink-0 items-center gap-4 border-border/70 border-t px-4 text-muted-foreground text-xs">
                <span>{stats.words.toLocaleString()} words</span>
                <span>{stats.lines.toLocaleString()} lines</span>
                <span>{stats.links.toLocaleString()} links</span>
                <span>{stats.characters.toLocaleString()} chars</span>
            </div>
        </div>
    );
}
