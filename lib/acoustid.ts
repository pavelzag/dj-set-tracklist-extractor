import { spawn } from 'child_process'
import https from 'https'
import { URLSearchParams } from 'url'

const CLIENT_KEY = process.env.ACOUSTID_API_KEY!

export interface RecognitionResult {
  title: string
  artist: string
  album?: string
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

function log(msg: string) { console.log(new Date().toISOString() + ' ' + msg) }

function runFpcalc(filePath: string): Promise<{ duration: number; fingerprint: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('fpcalc', ['-json', filePath])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) { reject(new Error(`fpcalc failed: ${err.trim()}`)); return }
      try {
        const json = JSON.parse(out) as { duration: number; fingerprint: string }
        resolve({ duration: Math.round(json.duration), fingerprint: json.fingerprint })
      } catch {
        reject(new Error(`fpcalc non-JSON: ${out.slice(0, 200)}`))
      }
    })
  })
}

export async function recognizeFile(filePath: string, label = ''): Promise<RecognitionResult | null> {
  const prefix = label ? `[acoustid${label}]` : '[acoustid]'

  const { duration, fingerprint } = await runFpcalc(filePath)

  const body = new URLSearchParams({
    client: CLIENT_KEY,
    fingerprint,
    duration: duration.toString(),
    meta: 'recordings+releasegroups+compress',
  }).toString()

  log(`${prefix} lookup duration=${duration}s`)
  const t0 = Date.now()

  const data = await new Promise<AcoustIdResponse>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.acoustid.org',
        path: '/v2/lookup',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
        res.on('end', () => {
          if (res.statusCode !== 200) { reject(new Error(`AcoustID HTTP ${res.statusCode}: ${raw.slice(0, 200)}`)); return }
          try { resolve(JSON.parse(raw) as AcoustIdResponse) }
          catch { reject(new Error(`AcoustID non-JSON: ${raw.slice(0, 200)}`)) }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  const elapsed = Date.now() - t0

  if (data.status !== 'ok' || !data.results?.length) {
    log(`${prefix} no match (${elapsed}ms)`)
    return null
  }

  // Pick the highest-scoring result that has full recording metadata
  for (const result of data.results) {
    if (!result.recordings?.length) continue

    const recording = result.recordings[0]
    const title = recording.title
    const artist = recording.artists?.[0]?.name

    if (!title || !artist) continue

    const confidence = Math.round((result.score ?? 0) * 100)
    const album = recording.releasegroups?.[0]?.title

    log(`${prefix} matched: ${artist} - ${title} (score=${result.score?.toFixed(2)}, ${elapsed}ms)`)

    // Construct a YouTube search link since AcoustID doesn't provide one directly
    const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}`

    return { title, artist, album, confidence, youtubeId: ytSearch }
  }

  log(`${prefix} results but no recording metadata (${elapsed}ms)`)
  return null
}

// AcoustID response types
interface AcoustIdResponse {
  status: string
  results?: Array<{
    id: string
    score?: number
    recordings?: Array<{
      id: string
      title?: string
      artists?: Array<{ id: string; name: string }>
      releasegroups?: Array<{ id: string; title: string; type?: string }>
    }>
  }>
}
