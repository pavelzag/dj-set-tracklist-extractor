import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { getVideoInfo, downloadAudio } from '@/lib/ytdlp'
import { getAudioDuration, extractChunk } from '@/lib/ffmpeg'
import { recognizeChunk } from '@/lib/audd'

export const maxDuration = 3600

const CHUNK_DURATION = 20 // seconds

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return new Response('Missing url parameter', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const jobId = randomUUID()
      const tmpDir = path.join('/tmp', jobId)

      try {
        fs.mkdirSync(tmpDir, { recursive: true })

        send('status', { message: 'Fetching video info...' })
        const info = await getVideoInfo(url)
        send('info', { title: info.title, duration: info.duration, uploader: info.uploader })

        send('status', { message: 'Downloading audio...' })
        const audioFile = await downloadAudio(url, tmpDir)

        const duration = await getAudioDuration(audioFile)
        const totalChunks = Math.ceil(duration / CHUNK_DURATION)
        send('status', { message: `Analyzing ${Math.round(duration / 60)} min set...`, total: totalChunks })

        let lastKey = ''

        for (let i = 0; i < totalChunks; i++) {
          const startTime = i * CHUNK_DURATION
          const chunkFile = path.join(tmpDir, `chunk_${i}.wav`)

          try {
            await extractChunk(audioFile, startTime, CHUNK_DURATION, chunkFile)
            const audioBuffer = fs.readFileSync(chunkFile)
            fs.unlinkSync(chunkFile)

            const result = await recognizeChunk(audioBuffer)
            send('progress', { current: i + 1, total: totalChunks })

            if (result) {
              const key = `${result.title}||${result.artist}`
              if (key !== lastKey) {
                send('track', { ...result, timestamp: startTime })
                lastKey = key
              }
            } else {
              // Reset dedup so the next real detection always fires
              lastKey = ''
            }
          } catch {
            send('progress', { current: i + 1, total: totalChunks })
          }
        }

        send('done', {})
      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Processing failed' })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
