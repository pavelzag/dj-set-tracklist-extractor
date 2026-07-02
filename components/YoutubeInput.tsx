'use client'

import { useState, useCallback, useRef } from 'react'
import type { Track, ProcessingState } from '@/types'

interface Props {
  onTrack: (track: Track) => void
  onStateChange: (state: ProcessingState) => void
  onSetTitle: (title: string) => void
  disabled: boolean
}

export default function YoutubeInput({ onTrack, onStateChange, onSetTitle, disabled }: Props) {
  const [url, setUrl] = useState('')
  const currentMessageRef = useRef('')

  const isValidUrl = (val: string) =>
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?|youtu\.be\/)/.test(val)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !isValidUrl(url) || disabled) return

    currentMessageRef.current = 'Connecting...'
    onStateChange({ status: 'processing', current: 0, total: 0, message: 'Connecting...' })

    const eventSource = new EventSource(`/api/youtube?url=${encodeURIComponent(url)}`)

    eventSource.addEventListener('info', (e) => {
      const data = JSON.parse(e.data) as { title: string }
      onSetTitle(data.title)
    })

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data) as { message: string; total?: number }
      currentMessageRef.current = data.message
      onStateChange({ status: 'processing', current: 0, total: data.total ?? 0, message: data.message })
    })

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as { current: number; total: number }
      onStateChange({ status: 'processing', current: data.current, total: data.total, message: currentMessageRef.current })
    })

    eventSource.addEventListener('track', (e) => {
      const track = JSON.parse(e.data) as Track
      onTrack(track)
    })

    eventSource.addEventListener('warning', (e) => {
      const data = JSON.parse(e.data) as { message: string }
      console.warn('Recognition warning:', data.message)
    })

    eventSource.addEventListener('done', (e) => {
      const data = JSON.parse(e.data) as { recognized: number; total: number; apiError: string | null }
      const msg = data.apiError
        ? `Done — API error: ${data.apiError}`
        : `Done — ${data.recognized} of ${data.total} chunks identified`
      onStateChange({ status: 'done', current: data.total, total: data.total, message: msg })
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      // Named 'error' SSE event from server (fatal pipeline failure)
      if ((e as MessageEvent).data) {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { message: string }
          onStateChange({ status: 'error', current: 0, total: 0, message: 'Error', error: data.message })
          eventSource.close()
          return
        } catch { /* fall through */ }
      }
      // Native EventSource error (connection dropped after stream ends — ignore)
    })
  }, [url, disabled, onTrack, onStateChange, onSetTitle])

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        disabled={disabled}
        className="flex-1 bg-surface-card border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !isValidUrl(url)}
        className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        Analyze
      </button>
    </form>
  )
}
