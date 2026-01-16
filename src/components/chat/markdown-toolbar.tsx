'use client'

import {
  BoldIcon as Bold,
  ItalicIcon as Italic,
  ListBulletIcon as List,
  CodeBracketIcon as Code,
  LinkIcon as Link,
  TableCellsIcon as Table
} from '@heroicons/react/24/outline'

interface MarkdownToolbarProps {
  onInsert: (text: string) => void
}

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const buttons = [
    {
      icon: Bold,
      label: '太字',
      insert: () => onInsert('**太字**')
    },
    {
      icon: Italic,
      label: '斜体',
      insert: () => onInsert('*斜体*')
    },
    {
      icon: List,
      label: '箇条書き',
      insert: () => onInsert('\n- 項目1\n- 項目2\n- 項目3\n')
    },
    {
      icon: Code,
      label: 'コードブロック',
      insert: () => onInsert('\n```\nコード\n```\n')
    },
    {
      icon: Link,
      label: 'リンク',
      insert: () => onInsert('[リンクテキスト](https://example.com)')
    },
    {
      icon: Table,
      label: '表',
      insert: () => onInsert('\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A   | B   | C   |\n')
    }
  ]

  return (
    <div className="flex items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/10 mb-2">
      {buttons.map((btn, index) => (
        <button
          key={index}
          onClick={btn.insert}
          className="p-2 hover:bg-white/10 rounded transition-colors group"
          title={btn.label}
          type="button"
        >
          <btn.icon className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
        </button>
      ))}

      {/* 見出しドロップダウン */}
      <select
        onChange={(e) => {
          if (e.target.value) {
            const level = parseInt(e.target.value)
            onInsert(`${'#'.repeat(level)} 見出し\n`)
            e.target.value = ''
          }
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

      {/* 水平線 */}
      <button
        onClick={() => onInsert('\n---\n')}
        className="ml-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="水平線"
        type="button"
      >
        HR
      </button>
    </div>
  )
}
