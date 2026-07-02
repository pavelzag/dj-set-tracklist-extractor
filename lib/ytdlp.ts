import { spawn } from 'child_process'
import path from 'path'

export interface VideoInfo {
  title: string
  duration: number
  uploader: string
}

// Builds cookie args based on environment:
//   YTDLP_COOKIES_BROWSER=chrome|firefox|safari  (local dev)
//   YTDLP_COOKIES_FILE=/path/to/cookies.txt      (Docker / Cloud Run)
function cookieArgs(): string[] {
  if (process.env.YTDLP_COOKIES_FILE) {
    return ['--cookies', process.env.YTDLP_COOKIES_FILE]
  }
  if (process.env.YTDLP_COOKIES_BROWSER) {
    return ['--cookies-from-browser', process.env.YTDLP_COOKIES_BROWSER]
  }
  return []
}

export function getVideoInfo(url: string): Promise<VideoInfo> {
  console.log(`${ts()} [yt-dlp] fetching info for ${url}`)
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--print', '%(title)s',
      '--print', '%(duration)s',
      '--print', '%(uploader)s',
      '--no-download',
      '--no-playlist',
      ...cookieArgs(),
      url,
    ])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`${ts()} [yt-dlp] info failed: ${err.slice(0, 300)}`)
        reject(new Error(`yt-dlp failed: ${err.slice(0, 300)}`))
        return
      }
      const [title, durationStr, uploader] = out.trim().split('\n')
      const info = { title: title ?? 'Unknown', duration: parseInt(durationStr ?? '0'), uploader: uploader ?? '' }
      console.log(`${ts()} [yt-dlp] info ok — "${info.title}" by ${info.uploader} (${info.duration}s)`)
      resolve(info)
    })
  })
}

export function downloadAudio(url: string, outputDir: string): Promise<string> {
  console.log(`${ts()} [yt-dlp] starting download to ${outputDir}`)
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(outputDir, 'audio.%(ext)s')
    const proc = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', outputTemplate,
      '--no-playlist',
      ...cookieArgs(),
      url,
    ])
    let err = ''
    proc.stdout.on('data', (d: Buffer) => {
      const line = d.toString().trim()
      if (line) console.log(`${ts()} [yt-dlp] ${line}`)
    })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`${ts()} [yt-dlp] download complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        resolve(path.join(outputDir, 'audio.mp3'))
      } else {
        console.error(`${ts()} [yt-dlp] download failed: ${err.slice(0, 300)}`)
        reject(new Error(`yt-dlp download failed: ${err.slice(0, 300)}`))
      }
    })
  })
}

function ts() { return new Date().toISOString() }
