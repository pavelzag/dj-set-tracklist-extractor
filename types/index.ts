export interface Track {
  title: string
  artist: string
  album?: string
  timestamp: number
  confidence: number
  spotifyId?: string
  youtubeId?: string
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'done' | 'error'
  current: number
  total: number
  message: string
  error?: string
}
