'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import { useEffect, useMemo, useRef, useState } from 'react'
import TurndownService from 'turndown'
import { marked } from 'marked'
import {
  BoldIcon as Bold,
  ItalicIcon as Italic,
  ListBulletIcon as List,
  CodeBracketIcon as Code,
  LinkIcon as LinkIcon
} from '@heroicons/react/24/outline'

interface RichTextEditorProps {
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
  editable?: boolean
  className?: string
  minHeight?: string
  maxHeight?: string
}

// Convert markdown to HTML for TipTap using marked library
async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return '<p></p>'

  try {
    const html = await marked.parse(markdown, { async: true })
    return html
  } catch (error) {
    console.error('Failed to parse markdown:', error)
    return `<p>${markdown}</p>`
  }
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Enter your text...',
  editable = true,
  className = '',
  minHeight = '44px',
  maxHeight = '300px'
}: RichTextEditorProps) {
  // Prevent infinite loops by tracking if we're updating internally
  const isInternalUpdate = useRef(false)

  // Force re-render for button states
  const [, forceUpdate] = useState(0)

  // Initialize Turndown service for HTML to Markdown conversion
  const turndownService = useMemo(() => {
    const service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    })
    return service
  }, [])

  // Initialize lowlight for code highlighting
  const lowlight = useMemo(() => {
    const lowlightInstance = createLowlight(common)
    return lowlightInstance
  }, [])

  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline hover:text-blue-600',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: '<p></p>',
    editable,
    onUpdate: ({ editor }) => {
      // Prevent infinite loops
      if (isInternalUpdate.current) {
        return
      }

      // Convert HTML to Markdown
      const html = editor.getHTML()
      const markdown = turndownService.turndown(html)
      onChange(markdown)
    },
    onTransaction: () => {
      // Force re-render whenever editor state changes
      // This ensures button states update immediately
      forceUpdate(prev => prev + 1)
    },
    editorProps: {
      attributes: {
        class: `prose prose-invert max-w-none focus:outline-none ${className}`,
      },
    },
  })

  // Update editor content when prop changes (from external source)
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return

    const updateContent = async () => {
      const currentMarkdown = turndownService.turndown(editor.getHTML())

      // Only update if content actually changed
      if (content !== currentMarkdown) {
        isInternalUpdate.current = true
        const html = await markdownToHtml(content)
        editor.commands.setContent(html)
        isInternalUpdate.current = false
      }
    }

    updateContent()
  }, [content, editor, turndownService])

  if (!editor) {
    return null
  }

  return (
    <div className="rich-text-editor">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/10 mb-2">
          {/* Bold */}
          <button
            onClick={() => {
              editor.chain().focus().toggleBold().run()
            }}
            className={`p-2 hover:bg-purple-500/20 rounded transition-colors ${
              editor.isActive('bold') ? 'bg-purple-500/30 text-purple-400' : 'text-gray-400'
            }`}
            title="太字"
            type="button"
          >
            <Bold className="h-4 w-4" />
          </button>

          {/* Italic */}
          <button
            onClick={() => {
              editor.chain().focus().toggleItalic().run()
            }}
            className={`p-2 hover:bg-purple-500/20 rounded transition-colors ${
              editor.isActive('italic') ? 'bg-purple-500/30 text-purple-400' : 'text-gray-400'
            }`}
            title="斜体"
            type="button"
          >
            <Italic className="h-4 w-4" />
          </button>

          {/* Bullet List */}
          <button
            onClick={() => {
              editor.chain().focus().toggleBulletList().run()
            }}
            className={`p-2 hover:bg-purple-500/20 rounded transition-colors ${
              editor.isActive('bulletList') ? 'bg-purple-500/30 text-purple-400' : 'text-gray-400'
            }`}
            title="箇条書き"
            type="button"
          >
            <List className="h-4 w-4" />
          </button>

          {/* Code Block */}
          <button
            onClick={() => {
              editor.chain().focus().toggleCodeBlock().run()
            }}
            className={`p-2 hover:bg-purple-500/20 rounded transition-colors ${
              editor.isActive('codeBlock') ? 'bg-purple-500/30 text-purple-400' : 'text-gray-400'
            }`}
            title="コードブロック"
            type="button"
          >
            <Code className="h-4 w-4" />
          </button>

          {/* Link */}
          <button
            onClick={() => {
              const url = window.prompt('URL:')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            className={`p-2 hover:bg-purple-500/20 rounded transition-colors ${
              editor.isActive('link') ? 'bg-purple-500/30 text-purple-400' : 'text-gray-400'
            }`}
            title="リンク"
            type="button"
          >
            <LinkIcon className="h-4 w-4" />
          </button>

          {/* Heading Dropdown */}
          <select
            onChange={(e) => {
              const level = parseInt(e.target.value)
              if (level) {
                editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()
              }
              e.target.value = ''
            }}
            className="ml-2 px-2 py-1 bg-white/10 rounded text-sm text-gray-300 hover:bg-white/20 transition-colors cursor-pointer border border-white/10"
            defaultValue=""
          >
            <option value="" disabled>見出し</option>
            <option value="1">H1</option>
            <option value="2">H2</option>
            <option value="3">H3</option>
            <option value="4">H4</option>
          </select>

          {/* Horizontal Rule */}
          <button
            onClick={() => {
              editor.chain().focus().setHorizontalRule().run()
            }}
            className="ml-1 px-2 py-1 text-xs text-gray-400 hover:text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
            title="水平線"
            type="button"
          >
            HR
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div className="block w-full resize-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus-within:bg-white/15 focus-within:border-white/30 transition-all duration-200">
        <EditorContent
          editor={editor}
          className="tiptap-editor"
        />
      </div>

      {/* Custom styles for editor text color */}
      <style jsx>{`
        :global(.tiptap-editor .ProseMirror) {
          color: #111827;
          min-height: ${minHeight};
          max-height: ${maxHeight};
          overflow-y: auto;
          line-height: 1.5;
        }
        :global(.tiptap-editor .ProseMirror:focus) {
          outline: none;
        }
        :global(.tiptap-editor .ProseMirror p) {
          margin: 0;
          padding: 0;
        }
        /* Placeholder - only show when editor is completely empty */
        :global(.tiptap-editor .ProseMirror.is-editor-empty p.is-empty:first-child::before) {
          color: #9ca3af;
          content: attr(data-placeholder);
          pointer-events: none;
          float: left;
          height: 0;
        }
        :global(.tiptap-editor .ProseMirror strong) {
          color: #111827;
          font-weight: bold;
        }
        :global(.tiptap-editor .ProseMirror em) {
          color: #111827;
          font-style: italic;
        }
        :global(.tiptap-editor .ProseMirror ul) {
          color: #111827;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          list-style-type: disc;
        }
        :global(.tiptap-editor .ProseMirror ul li) {
          color: #111827;
          display: list-item;
          list-style-type: disc;
          margin-left: 0;
        }
        :global(.tiptap-editor .ProseMirror ol) {
          color: #111827;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
          list-style-type: decimal;
        }
        :global(.tiptap-editor .ProseMirror ol li) {
          color: #111827;
          display: list-item;
          list-style-type: decimal;
        }
        :global(.tiptap-editor .ProseMirror h1) {
          color: #111827;
          font-weight: bold;
          font-size: 2em;
          margin: 0.5rem 0;
        }
        :global(.tiptap-editor .ProseMirror h2) {
          color: #111827;
          font-weight: bold;
          font-size: 1.5em;
          margin: 0.5rem 0;
        }
        :global(.tiptap-editor .ProseMirror h3) {
          color: #111827;
          font-weight: bold;
          font-size: 1.25em;
          margin: 0.5rem 0;
        }
        :global(.tiptap-editor .ProseMirror h4) {
          color: #111827;
          font-weight: bold;
          font-size: 1.1em;
          margin: 0.5rem 0;
        }
        :global(.tiptap-editor .ProseMirror code) {
          color: #111827;
          background-color: #e5e7eb;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }
        :global(.tiptap-editor .ProseMirror pre) {
          color: #111827;
          background-color: #1f2937;
          padding: 0.75rem;
          border-radius: 0.5rem;
          margin: 0.5rem 0;
        }
        :global(.tiptap-editor .ProseMirror pre code) {
          color: #e5e7eb;
          background-color: transparent;
        }
      `}</style>
    </div>
  )
}
