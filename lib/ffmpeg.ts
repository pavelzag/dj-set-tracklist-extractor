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
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(parseFloat(out.trim()))
      else reject(new Error('ffprobe failed'))
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
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
  })
}
