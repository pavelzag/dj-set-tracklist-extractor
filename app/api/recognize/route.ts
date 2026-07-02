import { NextRequest, NextResponse } from 'next/server'
import { recognizeChunk } from '@/lib/acr-cloud'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob | null

    if (!chunk) {
      return NextResponse.json({ error: 'Missing chunk' }, { status: 400 })
    }

    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const result = await recognizeChunk(buffer)

    return NextResponse.json({ track: result })
  } catch (error) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recognition failed' },
      { status: 500 }
    )
  }
}
