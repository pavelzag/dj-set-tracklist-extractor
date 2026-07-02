import { spawn } from 'child_process'
import path from 'path'

export interface VideoInfo {
  title: string
  duration: number
  uploader: string
}

export function getVideoInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--print', '%(title)s',
      '--print', '%(duration)s',
      '--print', '%(uploader)s',
      '--no-download',
      '--no-playlist',
      url,
    ])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed: ${err.slice(0, 300)}`))
        return
      }
      const [title, durationStr, uploader] = out.trim().split('\n')
      resolve({ title: title ?? 'Unknown', duration: parseInt(durationStr ?? '0'), uploader: uploader ?? '' })
    })
  })
}

export function downloadAudio(url: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(outputDir, 'audio.%(ext)s')
    const proc = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '-o', outputTemplate,
      '--no-playlist',
      url,
    ])
    let err = ''
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(path.join(outputDir, 'audio.mp3'))
      else reject(new Error(`yt-dlp download failed: ${err.slice(0, 300)}`))
    })
  })
}
