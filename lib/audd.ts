import FormData from 'form-data'
import https from 'https'

const API_TOKEN = process.env.AUDD_API_TOKEN!

export interface RecognitionResult {
  title: string
  artist: string
  album?: string
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

export async function recognizeChunk(audioBuffer: Buffer, label = ''): Promise<RecognitionResult | null> {
  const prefix = label ? `[audd${label}]` : '[audd]'

  const form = new FormData()
  form.append('api_token', API_TOKEN)
  form.append('return', 'spotify')
  form.append('audio', audioBuffer, { filename: 'chunk.wav', contentType: 'audio/wav' })

  log(`${prefix} POST api.audd.io — ${(audioBuffer.length / 1024).toFixed(0)} KB`)

  const t0 = Date.now()
  const data = await new Promise<AuddResponse>((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.audd.io', path: '/', method: 'POST', headers: form.getHeaders() },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => {
          try { resolve(JSON.parse(body) as AuddResponse) }
          catch { reject(new Error(`AudD non-JSON response: ${body.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    form.pipe(req)
  })
  const elapsed = Date.now() - t0

  log(`${prefix} response status="${data.status}" in ${elapsed}ms`)

  if (data.status !== 'success') {
    const msg = data.error?.error_message ?? `AudD error status: ${data.status}`
    log(`${prefix} API error: ${msg}`)
    throw new Error(msg)
  }

  if (!data.result) {
    log(`${prefix} no match`)
    return null
  }

  const r = data.result
  log(`${prefix} matched: "${r.artist} - ${r.title}"`)
  return {
    title: r.title,
    artist: r.artist,
    album: r.album || undefined,
    confidence: 100,
    spotifyId: r.spotify?.id,
  }
}

function log(msg: string) {
  console.log(`${new Date().toISOString()} ${msg}`)
}

interface AuddResponse {
  status: string
  error?: { error_code: number; error_message: string }
  result: {
    title: string
    artist: string
    album: string
    release_date: string
    spotify?: { id: string }
  } | null
}
