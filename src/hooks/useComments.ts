import { useState, useEffect, useCallback } from 'react'
import { NodeComment, CreateCommentRequest, UpdateCommentRequest, GetCommentsParams, UseCommentsReturn } from '@/types/comments'

export function useComments({ nodeId, sessionId, limit = 50, offset = 0 }: GetCommentsParams = {}): UseCommentsReturn {
  const [comments, setComments] = useState<NodeComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!nodeId && !sessionId) return

    setLoading(true)
    setError(undefined)

    try {
      const params = new URLSearchParams()
      if (nodeId) params.append('nodeId', nodeId)
      if (sessionId) params.append('sessionId', sessionId)
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())

      const response = await fetch(`/api/comments?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch comments')
      }

      // Convert date strings to Date objects
      const commentsWithDates = (data.data.comments || []).map((comment: any) => ({
        ...comment,
        created_at: new Date(comment.created_at),
        updated_at: new Date(comment.updated_at)
      }))

      setComments(commentsWithDates)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error fetching comments:', errorMessage)
    } finally {
      setLoading(false)
    }
  }, [nodeId, sessionId, limit, offset])

  // Create comment
  const createComment = useCallback(async (data: CreateCommentRequest): Promise<NodeComment | null> => {
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create comment')
      }

      // Convert date strings to Date objects
      const newComment = {
        ...result.data.comment,
        created_at: new Date(result.data.comment.created_at),
        updated_at: new Date(result.data.comment.updated_at)
      }

      // Add the new comment to the list
      setComments(prev => [...prev, newComment])
      
      return newComment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error creating comment:', errorMessage)
      return null
    }
  }, [])

  // Update comment
  const updateComment = useCallback(async (data: UpdateCommentRequest): Promise<NodeComment | null> => {
    try {
      const response = await fetch('/api/comments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update comment')
      }

      // Convert date strings to Date objects
      const updatedComment = {
        ...result.data.comment,
        created_at: new Date(result.data.comment.created_at),
        updated_at: new Date(result.data.comment.updated_at)
      }

      // Update the comment in the list
      setComments(prev => 
        prev.map(comment => 
          comment.id === updatedComment.id ? updatedComment : comment
        )
      )

      return updatedComment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error updating comment:', errorMessage)
      return null
    }
  }, [])

  // Delete comment
  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete comment')
      }

      // Remove the comment from the list
      setComments(prev => prev.filter(comment => comment.id !== commentId))
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('❌ Error deleting comment:', errorMessage)
      return false
    }
  }, [])

  // Refetch comments
  const refetch = useCallback(async () => {
    await fetchComments()
  }, [fetchComments])

  // Initial fetch on mount
  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  return {
    comments,
    loading,
    error,
    createComment,
    updateComment,
    deleteComment,
    refetch
  }
}