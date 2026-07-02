'use client'

import { useState, useCallback } from 'react'
import AudioDropzone from '@/components/AudioDropzone'
import YoutubeInput from '@/components/YoutubeInput'
import ProcessingStatus from '@/components/ProcessingStatus'
import TrackList from '@/components/TrackList'
import type { Track, ProcessingState } from '@/types'

const IDLE: ProcessingState = { status: 'idle', current: 0, total: 0, message: '' }

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [processingState, setProcessingState] = useState<ProcessingState>(IDLE)
  const [setTitle, setSetTitle] = useState<string>('')

  const isProcessing = processingState.status === 'processing'

  const handleTrack = useCallback((track: Track) => {
    setTracks((prev) => [...prev, track])
  }, [])

  const handleStateChange = useCallback((state: ProcessingState | ((prev: ProcessingState) => ProcessingState)) => {
    setProcessingState(state as ProcessingState)
  }, [])

  const handleReset = () => {
    setTracks([])
    setProcessingState(IDLE)
    setSetTitle('')
  }

  return (
    <main className="min-h-screen px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 mb-4">
            <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">DJ Set Tracklist Extractor</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Upload a mix or paste a YouTube link to identify every track with timestamps
          </p>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <AudioDropzone
            onTrack={handleTrack}
            onStateChange={handleStateChange}
            disabled={isProcessing}
          />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-xs text-zinc-600 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <YoutubeInput
            onTrack={handleTrack}
            onStateChange={handleStateChange}
            onSetTitle={setSetTitle}
            disabled={isProcessing}
          />
        </div>

        {/* Status */}
        <ProcessingStatus state={processingState} />

        {/* Results */}
        {tracks.length > 0 && (
          <>
            <TrackList tracks={tracks} setTitle={setTitle} />
            {processingState.status === 'done' && (
              <button
                onClick={handleReset}
                className="mt-6 w-full py-2.5 rounded-xl border border-white/10 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
