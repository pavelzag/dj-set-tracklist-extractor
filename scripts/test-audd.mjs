#!/usr/bin/env node
/**
 * Standalone AudD API test — runs outside Next.js.
 * Usage: AUDD_API_TOKEN=xxx node scripts/test-audd.mjs
 */

import https from 'https'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const TOKEN = process.env.AUDD_API_TOKEN
if (!TOKEN) {
  console.error('Set AUDD_API_TOKEN before running this script.')
  process.exit(1)
}

// ── Test 1: URL-based (confirms token works) ──────────────────────────────────
console.log('\n[Test 1] URL-based recognition (AudD example clip)...')
{
  const boundary = '----Boundary' + Date.now().toString(16)
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="api_token"\r\n\r\n${TOKEN}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\nhttps://audd.io/example.mp3\r\n` +
    `--${boundary}--\r\n`
  )
  const r = await send('api.audd.io', body, boundary)
  console.log('  Result:', JSON.stringify(r, null, 2))
}

// ── Test 2: Raw multipart file upload (no form-data package) ─────────────────
console.log('\n[Test 2] Raw multipart file upload to AudD...')
try {
  execSync('ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 -ar 44100 -ac 1 -f wav /tmp/audd_test.wav -y', { stdio: 'pipe' })
} catch {
  console.error('  ffmpeg not found — install it with: brew install ffmpeg')
  process.exit(1)
}

{
  const wavBuffer = readFileSync('/tmp/audd_test.wav')
  console.log(`  WAV size: ${wavBuffer.length} bytes`)

  const boundary = '----Boundary' + Date.now().toString(16)
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="api_token"\r\n\r\n${TOKEN}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="return"\r\n\r\nspotify\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="chunk.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
    wavBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  console.log(`  Body size: ${body.length} bytes`)

  const r = await send('api.audd.io', body, boundary)
  console.log('  Result:', JSON.stringify(r, null, 2))
}

function send(hostname, body, boundary) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = ''
        res.on('data', d => { data += d })
        res.on('end', () => {
          console.log(`  HTTP ${res.statusCode}`)
          try { resolve(JSON.parse(data)) } catch { resolve({ raw: data.slice(0, 300) }) }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
