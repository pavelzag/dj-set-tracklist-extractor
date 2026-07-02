#!/usr/bin/env node
/**
 * Standalone Shazam/RapidAPI test — runs outside Next.js.
 * Usage: RAPIDAPI_KEY=xxx node scripts/test-shazam.mjs
 */

import https from 'https'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const KEY = process.env.RAPIDAPI_KEY
if (!KEY) {
  console.error('Set RAPIDAPI_KEY before running this script.')
  process.exit(1)
}

// Create a 10-second chunk of a real song using yt-dlp + ffmpeg
console.log('\n[Setup] Downloading 10s of a test song from YouTube...')
try {
  execSync(
    'yt-dlp -x --audio-format mp3 --audio-quality 5 -o /tmp/test_full.%(ext)s --no-playlist "https://www.youtube.com/watch?v=aJOTlE1K90k" --quiet',
    { stdio: 'pipe' }
  )
  execSync('ffmpeg -i /tmp/test_full.mp3 -ss 30 -t 10 -ar 44100 -ac 1 -f wav /tmp/test_chunk.wav -y', { stdio: 'pipe' })
  console.log('  Done.')
} catch (e) {
  console.error('  Setup failed:', e.message)
  process.exit(1)
}

console.log('\n[Test] Sending chunk to Shazam API...')
const audioBuffer = readFileSync('/tmp/test_chunk.wav')
const b64 = audioBuffer.toString('base64')
const body = Buffer.from(b64)

console.log(`  Audio: ${audioBuffer.length} bytes → ${body.length} bytes base64`)

const result = await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname: 'shazam.p.rapidapi.com',
      path: '/songs/v2/detect?timezone=UTC&locale=en-US',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': body.length,
        'X-RapidAPI-Key': KEY,
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com',
      },
    },
    (res) => {
      let raw = ''
      res.on('data', d => { raw += d })
      res.on('end', () => {
        console.log(`  HTTP ${res.statusCode}`)
        try { resolve(JSON.parse(raw)) } catch { resolve({ raw: raw.slice(0, 500) }) }
      })
    }
  )
  req.on('error', reject)
  req.write(body)
  req.end()
})

if (result.track) {
  console.log(`\n✓ Matched: "${result.track.subtitle} - ${result.track.title}"`)
} else {
  console.log('\n✗ No match. Full response:')
  console.log(JSON.stringify(result, null, 2))
}
