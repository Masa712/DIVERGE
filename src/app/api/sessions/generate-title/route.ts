'use server'

import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userMessage, assistantResponse } = body

    if (!userMessage) {
      return NextResponse.json(
        { error: 'User message is required' },
        { status: 400 }
      )
    }

    // Generate a concise title based on the conversation
    const systemPrompt = `You are a helpful assistant that generates concise, descriptive titles for chat conversations.
Based on the user's first message and optionally the assistant's response, generate a short title (3-7 words) that captures the essence of the conversation.
The title should be:
- Clear and descriptive
- In the same language as the user's message
- Without quotes or special characters
- Focused on the main topic or question

Examples:
User: "How do I implement authentication in Next.js?"
Title: Next.js Authentication Implementation

User: "ホテル経営について教えてください"
Title: ホテル経営について

User: "Can you help me debug this Python error?"
Title: Python Error Debugging Help`

    const userPrompt = assistantResponse 
      ? `User's first message: "${userMessage}"\n\nAssistant's response summary: "${assistantResponse.substring(0, 500)}..."\n\nGenerate a concise title for this conversation.`
      : `User's first message: "${userMessage}"\n\nGenerate a concise title for this conversation.`

    const client = new OpenRouterClient()
    const completion = await client.createChatCompletion({
      model: 'openai/gpt-4o-2024-11-20', // Using GPT-4o for better title generation
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 50,
      temperature: 0.7,
    })

    const title = completion.choices[0]?.message?.content?.trim() || 'New Chat'

    return NextResponse.json({
      success: true,
      title: title
    })
  } catch (error) {
    console.error('Error generating title:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    )
  }
}