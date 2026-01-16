/**
 * User Notes API Endpoints
 * POST /api/user-notes - Create a new user note
 * GET /api/user-notes?sessionId=xxx - Get session notes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createUserNote, getSessionUserNotes } from '@/lib/db/user-notes'
import { CreateUserNoteInput } from '@/types'

/**
 * POST /api/user-notes
 * ユーザーノートを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateUserNoteInput = await request.json()

    // バリデーション
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content is required and cannot be empty' },
        { status: 400 }
      )
    }

    const node = await createUserNote(body)

    return NextResponse.json(node, { status: 201 })
  } catch (error) {
    console.error('Failed to create user note:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * GET /api/user-notes?sessionId=xxx
 * セッションのユーザーノート一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 }
      )
    }

    const notes = await getSessionUserNotes(sessionId)

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Failed to fetch user notes:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
