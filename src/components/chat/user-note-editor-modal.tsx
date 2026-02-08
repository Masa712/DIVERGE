'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { ChatNode } from '@/types'
import { RichTextEditor } from './rich-text-editor'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface UserNoteEditorModalProps {
  node: ChatNode | null
  isOpen: boolean
  onClose: () => void
  onSave: (nodeId: string, updates: { title?: string; content: string; tags?: string[] }) => Promise<void>
}

export function UserNoteEditorModal({
  node,
  isOpen,
  onClose,
  onSave
}: UserNoteEditorModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ノードが変更されたら状態を更新
  useEffect(() => {
    if (node && isOpen) {
      setTitle(node.metadata?.noteTitle || '')
      setContent(node.prompt)
    }
  }, [node, isOpen])

  if (!isOpen || !node) return null

  const handleSave = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      await onSave(node.id, {
        title: title.trim() || undefined,
        content: content.trim()
      })
      onClose()
    } catch (error) {
      console.error('Failed to save note:', error)
      // エラー表示は親コンポーネントで処理
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">ノートを編集</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            type="button"
          >
            <XMarkIcon className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              タイトル（オプション）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="ノートのタイトル"
            />
          </div>

          {/* プレビュー/編集切り替え */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(false)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                !showPreview
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              type="button"
            >
              編集
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                showPreview
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              type="button"
            >
              プレビュー
            </button>
          </div>

          {!showPreview ? (
            /* Rich Text Editor */
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">
                内容
              </label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="ノートの内容を入力してください"
                editable={!saving}
                minHeight="400px"
                maxHeight="400px"
              />
            </div>
          ) : (
            /* プレビュー表示 */
            <div className="prose prose-invert max-w-none min-h-[400px] p-4 bg-gray-700 rounded border border-gray-600">
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">プレビューする内容がありません</p>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            type="button"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
