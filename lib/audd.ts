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
  const boundary = `----AuddBoundary${Math.random().toString(36).slice(2)}`

  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="api_token"\r\n\r\n${API_TOKEN}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="return"\r\n\r\nspotify\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="chunk.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]

  const body = Buffer.concat(parts)
  log(`${prefix} POST api.audd.io — ${(audioBuffer.length / 1024).toFixed(0)} KB`)

  const t0 = Date.now()
  const response = await fetch('https://api.audd.io/', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
  const elapsed = Date.now() - t0

  if (!response.ok) {
    log(`${prefix} HTTP ${response.status} after ${elapsed}ms`)
    throw new Error(`AudD HTTP ${response.status}`)
  }

  const data = await response.json() as AuddResponse
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
