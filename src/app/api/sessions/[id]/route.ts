import { NextRequest, NextResponse } from 'next/server'
import { getSessionById, deleteSession, updateSessionAccess } from '@/lib/db/sessions'
import { getSessionChatNodes } from '@/lib/db/chat-nodes'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    
    const session = await getSessionById(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Update last accessed time
    await updateSessionAccess(sessionId)
    
    // Get chat nodes for this session
    const chatNodes = await getSessionChatNodes(sessionId)
    
    return NextResponse.json({ 
      session,
      chatNodes 
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    
    await deleteSession(sessionId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}