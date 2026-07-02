import { NextRequest, NextResponse } from 'next/server'
import { recognizeFile } from '@/lib/shazam'
import { randomUUID } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const maxDuration = 30

const ts = () => new Date().toISOString()

export async function POST(request: NextRequest) {
  let tmpFile: string | null = null
  try {
    const formData = await request.formData()
    const chunk = formData.get('chunk') as Blob | null

    if (!chunk) {
      return NextResponse.json({ error: 'Missing chunk' }, { status: 400 })
    }

    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Write to a temp file so AudD can be streamed via ReadStream
    tmpFile = path.join(os.tmpdir(), `chunk_${randomUUID()}.mp3`)
    fs.writeFileSync(tmpFile, buffer)

    const timestamp = request.nextUrl.searchParams.get('t') ?? '?'
    console.log(`${ts()} [recognize] chunk @${timestamp}s — ${(buffer.length / 1024).toFixed(0)} KB`)

    const result = await recognizeFile(tmpFile)

    if (result) {
      console.log(`${ts()} [recognize] matched: ${result.artist} - ${result.title}`)
    } else {
      console.log(`${ts()} [recognize] no match`)
    }

    return NextResponse.json({ track: result })
  } catch (error) {
    console.error(`${ts()} [recognize] error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Recognition failed' },
      { status: 500 }
    )
  } finally {
    if (tmpFile) fs.rmSync(tmpFile, { force: true })
  }
}
