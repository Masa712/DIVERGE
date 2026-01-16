'use client'

import { useState, useCallback } from 'react'
import { ChatNode, CreateUserNoteInput, UpdateUserNoteInput } from '@/types'

export function useUserNotes(sessionId?: string) {
  const [notes, setNotes] = useState<ChatNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * ユーザーノートを作成
   */
  const createNote = useCallback(async (input: CreateUserNoteInput): Promise<ChatNode> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create note')
      }

      const newNote = await response.json()
      setNotes(prev => [newNote, ...prev])
      return newNote
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * ユーザーノートを更新
   */
  const updateNote = useCallback(async (
    nodeId: string,
    updates: UpdateUserNoteInput
  ): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user-notes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update note')
      }

      const updatedNote = await response.json()

      // ローカル状態を更新
      setNotes(prev => prev.map(note =>
        note.id === nodeId ? updatedNote : note
      ))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * ユーザーノートを削除
   */
  const deleteNote = useCallback(async (nodeId: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user-notes/${nodeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete note')
      }

      setNotes(prev => prev.filter(note => note.id !== nodeId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * セッションのノート一覧を取得
   */
  const fetchNotes = useCallback(async (sessionId: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user-notes?sessionId=${sessionId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch notes')
      }

      const data = await response.json()
      setNotes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    fetchNotes
  }
}
