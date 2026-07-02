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

// Shazam API accepts raw binary audio bytes with Content-Type: text/plain (not base64)
export async function recognizeFile(filePath: string, label = ''): Promise<RecognitionResult | null> {
  const prefix = label ? `[shazam${label}]` : '[shazam]'
  const body = fs.readFileSync(filePath)

  log(`${prefix} POST shazam.p.rapidapi.com — ${(body.length / 1024).toFixed(0)} KB`)

  const t0 = Date.now()
  const data = await new Promise<ShazamResponse | null>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'shazam.p.rapidapi.com',
        path: '/songs/detect',
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
          // 204 = no match (empty body), 200 = match with JSON
          if (res.statusCode === 204 || !raw.trim()) { resolve(null); return }
          if (res.statusCode !== 200) { reject(new Error(`Shazam HTTP ${res.statusCode}: ${raw.slice(0, 200)}`)); return }
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

  if (!data?.track) {
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
