import { spawn } from 'child_process'

export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(out.trim())
        console.log(`${ts()} [ffprobe] duration=${duration.toFixed(1)}s`)
        resolve(duration)
      } else {
        console.error(`${ts()} [ffprobe] failed: ${err.trim()}`)
        reject(new Error('ffprobe failed'))
      }
    })
  })
}

export function extractChunk(
  inputFile: string,
  startSeconds: number,
  durationSeconds: number,
  outputFile: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-ss', startSeconds.toString(),
      '-i', inputFile,
      '-t', durationSeconds.toString(),
      '-ar', '44100',
      '-ac', '1',
      '-f', 'wav',
      '-y',
      outputFile,
    ])
    let err = ''
    proc.stderr.on('data', (d: Buffer) => { err += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else {
        console.error(`${ts()} [ffmpeg] chunk @${startSeconds}s failed: ${err.slice(-200)}`)
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
  })
}

function ts() { return new Date().toISOString() }
