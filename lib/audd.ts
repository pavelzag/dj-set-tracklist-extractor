const API_TOKEN = process.env.AUDD_API_TOKEN!

export interface RecognitionResult {
  title: string
  artist: string
  album?: string
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

export async function recognizeChunk(audioBuffer: Buffer): Promise<RecognitionResult | null> {
  const boundary = `----AuddBoundary${Math.random().toString(36).slice(2)}`

  const parts: Buffer[] = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="api_token"\r\n\r\n${API_TOKEN}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="return"\r\n\r\nspotify\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="chunk.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]

  const response = await fetch('https://api.audd.io/', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(parts),
  })

  if (!response.ok) {
    throw new Error(`AudD HTTP ${response.status}`)
  }

  const data = await response.json() as AuddResponse

  if (data.status !== 'success') {
    const msg = data.error?.error_message ?? `AudD error status: ${data.status}`
    throw new Error(msg)
  }

  if (!data.result) {
    return null // no match found, not an error
  }

  const r = data.result
  return {
    title: r.title,
    artist: r.artist,
    album: r.album || undefined,
    confidence: 100, // AudD doesn't return a confidence score
    spotifyId: r.spotify?.id,
  }
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
