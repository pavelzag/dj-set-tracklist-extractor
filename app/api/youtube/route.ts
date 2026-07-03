import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { getVideoInfo, downloadAudio } from '@/lib/ytdlp'
import { getAudioDuration, extractChunk } from '@/lib/ffmpeg'
import { recognizeFile } from '@/lib/acoustid'

export const maxDuration = 3600

const CHUNK_DURATION = 10 // seconds — Shazam works best with 5-15s samples

const ts = () => new Date().toISOString()
const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
        console.log(`${ts()} [job:${jobId}] start url=${url}`)

        send('status', { message: 'Fetching video info...' })
        const info = await getVideoInfo(url)
        send('info', { title: info.title, duration: info.duration, uploader: info.uploader })

        send('status', { message: 'Downloading audio...' })
        const audioFile = await downloadAudio(url, tmpDir)

        const duration = await getAudioDuration(audioFile)
        const totalChunks = Math.ceil(duration / CHUNK_DURATION)
        console.log(`${ts()} [job:${jobId}] ${totalChunks} chunks to process (${CHUNK_DURATION}s each)`)
        send('status', { message: `Analyzing ${Math.round(duration / 60)} min set...`, total: totalChunks })

        let lastKey = ''
        let recognized = 0
        let apiError: string | null = null

        for (let i = 0; i < totalChunks; i++) {
          const startTime = i * CHUNK_DURATION
          const chunkFile = path.join(tmpDir, `chunk_${i}.mp3`)

          try {
            await extractChunk(audioFile, startTime, CHUNK_DURATION, chunkFile)

            const label = ` chunk ${i + 1}/${totalChunks} @${formatTime(startTime)}`
            const result = await recognizeFile(chunkFile, label)
            fs.unlinkSync(chunkFile)
            send('progress', { current: i + 1, total: totalChunks })

            if (result) {
              recognized++
              const key = `${result.title}||${result.artist}`
              if (key !== lastKey) {
                console.log(`${ts()} [job:${jobId}] NEW TRACK @${formatTime(startTime)}: ${result.artist} - ${result.title}`)
                send('track', { ...result, timestamp: startTime })
                lastKey = key
              }
            } else {
              lastKey = ''
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            console.error(`${ts()} [job:${jobId}] chunk ${i + 1} error: ${msg}`)
            if (!apiError) {
              apiError = msg
              send('warning', { message: `Recognition error: ${msg}` })
            }
            send('progress', { current: i + 1, total: totalChunks })
          }
        }

        console.log(`${ts()} [job:${jobId}] done — ${recognized}/${totalChunks} chunks recognized`)
        send('done', { recognized, total: totalChunks, apiError })
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Processing failed'
        console.error(`${ts()} [job:${jobId}] fatal error: ${msg}`)
        send('error', { message: msg })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        console.log(`${ts()} [job:${jobId}] tmp cleaned up`)
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
