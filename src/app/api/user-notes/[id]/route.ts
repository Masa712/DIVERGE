/**
 * User Notes API Endpoints (Single Note)
 * GET /api/user-notes/[id] - Get a specific note
 * PUT /api/user-notes/[id] - Update a note
 * DELETE /api/user-notes/[id] - Delete a note
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserNoteById, updateUserNote, deleteUserNote } from '@/lib/db/user-notes'
import { UpdateUserNoteInput } from '@/types'

/**
 * GET /api/user-notes/[id]
 * 特定のユーザーノートを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const note = await getUserNoteById(params.id)
    return NextResponse.json(note)
  } catch (error) {
    console.error('Failed to fetch user note:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401
                 : message.includes('not found') ? 404
                 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * PUT /api/user-notes/[id]
 * ユーザーノートを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: UpdateUserNoteInput = await request.json()

    // 少なくとも1つの更新フィールドが必要
    if (!body.title && !body.content && !body.tags) {
      return NextResponse.json(
        { error: 'At least one field (title, content, or tags) must be provided' },
        { status: 400 }
      )
    }

    const updated = await updateUserNote(params.id, body)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update user note:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401
                 : message.includes('not found') ? 404
                 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * DELETE /api/user-notes/[id]
 * ユーザーノートを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteUserNote(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete user note:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401
                 : message.includes('not found') ? 404
                 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
