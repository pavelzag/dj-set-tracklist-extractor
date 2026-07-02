// Encodes a mono Float32Array of PCM samples to a WAV Blob
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const numChannels = 1
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)            // chunk size
  view.setUint16(20, 1, true)             // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, 16, true)            // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

// Mixes down all channels to mono by averaging
export function mixdownToMono(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)

  for (let c = 0; c < numChannels; c++) {
    const channel = audioBuffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i] / numChannels
    }
  }

  return mono
}
