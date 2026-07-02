import fs from 'fs'
import https from 'https'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!

export interface RecognitionResult {
  title: string
  artist: string
  album?: string
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

// Shazam API accepts raw audio bytes as base64, Content-Type: text/plain
export async function recognizeFile(filePath: string, label = ''): Promise<RecognitionResult | null> {
  const prefix = label ? `[shazam${label}]` : '[shazam]'
  const audioBuffer = fs.readFileSync(filePath)
  const b64 = audioBuffer.toString('base64')

  log(`${prefix} POST shazam.p.rapidapi.com — ${(audioBuffer.length / 1024).toFixed(0)} KB`)

  const t0 = Date.now()
  const data = await new Promise<ShazamResponse>((resolve, reject) => {
    const body = Buffer.from(b64)
    const req = https.request(
      {
        hostname: 'shazam.p.rapidapi.com',
        path: '/songs/v2/detect?timezone=UTC&locale=en-US',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': body.length,
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'shazam.p.rapidapi.com',
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          try { resolve(JSON.parse(raw) as ShazamResponse) }
          catch { reject(new Error(`Shazam non-JSON: ${raw.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
  const elapsed = Date.now() - t0

  if (!data.track) {
    log(`${prefix} no match (${elapsed}ms)`)
    return null
  }

  const track = data.track
  const spotifyId = track.hub?.providers
    ?.find(p => p.type === 'SPOTIFY')
    ?.actions?.[0]?.uri
    ?.split(':')[2]

  log(`${prefix} matched: "${track.subtitle} - ${track.title}" (${elapsed}ms)`)
  return {
    title: track.title,
    artist: track.subtitle,
    album: track.sections?.find(s => s.type === 'SONG')?.metadata?.find(m => m.title === 'Album')?.text,
    confidence: 100,
    spotifyId,
  }
}

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`)
}

interface ShazamResponse {
  matches?: unknown[]
  track?: {
    title: string
    subtitle: string
    hub?: {
      providers?: Array<{
        type: string
        actions?: Array<{ uri: string }>
      }>
    }
    sections?: Array<{
      type: string
      metadata?: Array<{ title: string; text: string }>
    }>
  }
}
