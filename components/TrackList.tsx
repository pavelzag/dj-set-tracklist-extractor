'use client'

import type { Track } from '@/types'

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  tracks: Track[]
  setTitle?: string
}

export default function TrackList({ tracks, setTitle }: Props) {
  if (tracks.length === 0) return null

  const exportText = () => {
    const lines = tracks.map(
      (t, i) => `${i + 1}. [${formatTimestamp(t.timestamp)}] ${t.artist} - ${t.title}`
    )
    const text = (setTitle ? `${setTitle}\n\n` : '') + lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tracklist.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} identified
          </h2>
          {setTitle && <p className="text-sm text-zinc-400 mt-0.5">{setTitle}</p>}
        </div>
        <button
          onClick={exportText}
          className="text-sm px-4 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          Export .txt
        </button>
      </div>

      <div className="space-y-2">
        {tracks.map((track, i) => (
          <div
            key={`${track.timestamp}-${i}`}
            className="flex items-start gap-4 p-4 rounded-xl bg-surface-card border border-white/5 hover:border-violet-500/30 transition-colors group"
          >
            <span className="text-xs font-mono text-violet-400 pt-0.5 w-14 shrink-0">
              {formatTimestamp(track.timestamp)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white truncate">{track.title}</p>
              <p className="text-sm text-zinc-400 truncate">{track.artist}</p>
              {track.album && (
                <p className="text-xs text-zinc-600 truncate mt-0.5">{track.album}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {track.spotifyId && (
                <a
                  href={`https://open.spotify.com/track/${track.spotifyId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors"
                >
                  Spotify
                </a>
              )}
              {track.youtubeId && (
                <a
                  href={`https://youtube.com/watch?v=${track.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  YT
                </a>
              )}
            </div>
            <span className="text-xs text-zinc-600 shrink-0 pt-0.5">
              {track.confidence}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
