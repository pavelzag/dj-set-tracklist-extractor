'use client'

import type { ProcessingState } from '@/types'

interface Props {
  state: ProcessingState
}

export default function ProcessingStatus({ state }: Props) {
  if (state.status === 'idle') return null

  const pct = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0

  return (
    <div className="mt-6 p-4 rounded-xl bg-surface-card border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-zinc-300">{state.message}</p>
        {state.status === 'processing' && state.total > 0 && (
          <span className="text-xs text-zinc-500 font-mono">
            {state.current}/{state.total}
          </span>
        )}
      </div>

      {state.status === 'processing' && state.total > 0 && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {state.status === 'processing' && state.total === 0 && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500 rounded-full animate-pulse" />
        </div>
      )}

      {state.status === 'error' && (
        <p className="text-sm text-red-400 mt-1">{state.error}</p>
      )}
    </div>
  )
}
