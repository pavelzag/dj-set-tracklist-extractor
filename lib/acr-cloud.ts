import crypto from 'crypto'

const HOST = process.env.ACR_HOST!
const ACCESS_KEY = process.env.ACR_ACCESS_KEY!
const ACCESS_SECRET = process.env.ACR_ACCESS_SECRET!

export interface RecognitionResult {
  title: string
  artist: string
  album?: string
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

export async function recognizeChunk(audioBuffer: Buffer): Promise<RecognitionResult | null> {
  const timestamp = Math.floor(Date.now() / 1000)
  const stringToSign = `POST\n/v1/identify\n${ACCESS_KEY}\naudio\n1\n${timestamp}`
  const signature = crypto
    .createHmac('sha1', ACCESS_SECRET)
    .update(stringToSign)
    .digest('base64')

  const boundary = `----AcrBoundary${crypto.randomBytes(8).toString('hex')}`

  const parts: Buffer[] = []
  const addField = (name: string, value: string) => {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ))
  }

  addField('access_key', ACCESS_KEY)
  addField('timestamp', timestamp.toString())
  addField('signature', signature)
  addField('signature_version', '1')
  addField('data_type', 'audio')
  addField('sample_bytes', audioBuffer.length.toString())

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="sample"; filename="chunk.wav"\r\nContent-Type: audio/wav\r\n\r\n`
  ))
  parts.push(audioBuffer)
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch(`https://${HOST}/v1/identify`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })

  if (!response.ok) {
    throw new Error(`ACRCloud HTTP ${response.status}`)
  }

  const data = await response.json() as AcrResponse

  if (data.status.code !== 0 || !data.metadata?.music?.length) {
    return null
  }

  const track = data.metadata.music[0]
  return {
    title: track.title,
    artist: track.artists?.[0]?.name ?? 'Unknown Artist',
    album: track.album?.name,
    confidence: track.score,
    spotifyId: track.external_metadata?.spotify?.track?.id,
    youtubeId: track.external_metadata?.youtube?.vid,
  }
}

interface AcrResponse {
  status: { code: number; msg: string }
  metadata?: {
    music?: Array<{
      title: string
      score: number
      artists?: Array<{ name: string }>
      album?: { name: string }
      external_metadata?: {
        spotify?: { track?: { id: string } }
        youtube?: { vid: string }
      }
    }>
  }
}
