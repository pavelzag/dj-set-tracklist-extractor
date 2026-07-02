'use client'

import { useCallback, useRef, useState } from 'react'
import type { Track, ProcessingState } from '@/types'
import { encodeWAV, mixdownToMono } from '@/lib/wav-encoder'

const CHUNK_DURATION = 10 // seconds
const SUPPORTED = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/flac', 'audio/aac']

interface Props {
  onTrack: (track: Track) => void
  onStateChange: (state: ProcessingState) => void
  disabled: boolean
}

export default function AudioDropzone({ onTrack, onStateChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    onStateChange({ status: 'processing', current: 0, total: 0, message: 'Decoding audio...' })

    let audioBuffer: AudioBuffer
    try {
      const arrayBuffer = await file.arrayBuffer()
      const ctx = new AudioContext()
      audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      ctx.close()
    } catch {
      onStateChange({ status: 'error', current: 0, total: 0, message: 'Failed to decode audio', error: 'File may be corrupted or an unsupported format.' })
      return
    }

    const mono = mixdownToMono(audioBuffer)
    const sampleRate = audioBuffer.sampleRate
    const samplesPerChunk = Math.floor(sampleRate * CHUNK_DURATION)
    const totalChunks = Math.ceil(mono.length / samplesPerChunk)

    onStateChange({ status: 'processing', current: 0, total: totalChunks, message: `Analyzing ${Math.round(audioBuffer.duration / 60)} min set...` })

    let lastKey = ''

    for (let i = 0; i < totalChunks; i++) {
      const start = i * samplesPerChunk
      const slice = mono.slice(start, start + samplesPerChunk)
      const wavBlob = encodeWAV(slice, sampleRate)

      try {
        const form = new FormData()
        form.append('chunk', wavBlob, 'chunk.wav')

        const res = await fetch(`/api/recognize?t=${i * CHUNK_DURATION}`, { method: 'POST', body: form })
        const data = await res.json() as { track: Track | null }

        onStateChange({ status: 'processing', current: i + 1, total: totalChunks, message: `Analyzing ${Math.round(audioBuffer.duration / 60)} min set...` })

        if (data.track) {
          const key = `${data.track.title}||${data.track.artist}`
          if (key !== lastKey) {
            onTrack({ ...data.track, timestamp: i * CHUNK_DURATION })
            lastKey = key
          }
        } else {
          lastKey = ''
        }
      } catch {
        onStateChange({ status: 'processing', current: i + 1, total: totalChunks, message: `Analyzing ${Math.round(audioBuffer.duration / 60)} min set...` })
      }
    }

    onStateChange({ status: 'done', current: totalChunks, total: totalChunks, message: 'Analysis complete' })
  }, [onTrack, onStateChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [disabled, processFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        'relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all',
        dragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 hover:border-zinc-500',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED.join(',')}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-zinc-300 font-medium">Drop your mix here</p>
        <p className="text-sm text-zinc-500 mt-1">WAV, MP3, FLAC, AAC supported</p>
      </div>
    </div>
  )
}
